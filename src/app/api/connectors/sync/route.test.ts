// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { balanceSnapshots, connectedAccounts, connectorAuditLog } from '@/lib/db/schema'
import { getUserTier, resetSubscriptionTierCache } from '@/lib/subscription'
import {
  createTestDb, seedConnectedAccount, seedPrograms, seedUser, sessionFor, testId,
  type SeededUser, type TestDb,
} from '@/test/utils/test-db'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))

vi.mock('@/lib/connectors/token-vault', () => ({
  decryptToken: vi.fn().mockReturnValue('decrypted-token-123'),
}))

// The orchestrator (retries/backoff) is unit-tested separately; here it simply
// drives the persistence callbacks the route provides, which hit the database.
let mockSyncOutcome: Record<string, unknown> = { status: 'ok', result: { balances: {}, cursor: null } }
vi.mock('@/lib/connectors/sync-orchestrator', () => ({
  runAccountSync: vi.fn().mockImplementation(async (_adapter, context, persistence) => {
    const accountId = (context as { account: { id: string } }).account.id
    await persistence.markSyncing(accountId)
    if (mockSyncOutcome.status === 'ok') {
      await persistence.markSuccess(accountId, (mockSyncOutcome as { result: unknown }).result)
    } else if (mockSyncOutcome.status === 'auth_error') {
      await persistence.markAuthError(accountId)
    } else {
      const outcome = mockSyncOutcome as { errorCode: 'provider_error' | 'rate_limit'; message: string }
      await persistence.markError(accountId, outcome.errorCode, outcome.message)
    }
    return mockSyncOutcome
  }),
  isAccountStale: vi.fn().mockReturnValue(false),
  SYNC_POLICY: { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, staleThresholdMs: 14400000 },
}))

vi.mock('@/lib/connectors/connector-registry', () => ({
  connectorRegistry: {
    get: vi.fn().mockReturnValue({
      providerId: 'amex',
      displayName: 'American Express',
      capabilities: { supportsIncrementalSync: false, requiresOAuth: true, minSyncIntervalSeconds: 3600 },
      fetchBalance: vi.fn(),
      validateCredentials: vi.fn(),
    }),
  },
}))

vi.mock('@/lib/subscription', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/subscription')>()
  return { ...actual, getUserTier: vi.fn() }
})

const { POST } = await import('./route')

let db: TestDb
let pat: SeededUser
const sync = (body: unknown) => POST(new NextRequest('https://pointsmax.com/api/connectors/sync', {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  resetSubscriptionTierCache()
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [{ key: 'amex-mr' }, { key: 'chase-ur' }])
  pat = await seedUser(db, 'pat', { tier: 'premium' })
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(pat))
  vi.mocked(getUserTier).mockResolvedValue('premium')
  mockSyncOutcome = { status: 'ok', result: { balances: {}, cursor: null } }
})

afterAll(() => setDbForTesting(null))

describe('POST /api/connectors/sync', () => {
  it('requires a session and premium access', async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null)
    expect((await sync({ account_id: testId('x') })).status).toBe(401)

    vi.mocked(getUserTier).mockResolvedValueOnce('free')
    const res = await sync({ account_id: testId('x') })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('PREMIUM_REQUIRED')
  })

  it('validates the body', async () => {
    expect((await sync('nope')).status).toBe(400)
    expect((await sync({})).status).toBe(400)
    expect((await sync({ account_id: '' })).status).toBe(400)
  })

  it('returns 404 for missing or foreign accounts and 400 for inactive ones', async () => {
    expect((await sync({ account_id: testId('missing') })).status).toBe(404)
    const sam = await seedUser(db, 'sam')
    expect((await sync({ account_id: await seedConnectedAccount(db, sam) })).status).toBe(404)

    const expired = await seedConnectedAccount(db, pat, { status: 'expired' })
    expect((await (await sync({ account_id: expired })).json()).error).toMatch(/expired/)
    const revoked = await seedConnectedAccount(db, pat, { provider: 'chase', status: 'revoked' })
    expect((await (await sync({ account_id: revoked })).json()).error).toMatch(/revoked/)
  })

  it('stores snapshots and marks the account synced on success', async () => {
    const id = await seedConnectedAccount(db, pat, { syncStatus: 'pending' })
    mockSyncOutcome = {
      status: 'ok',
      result: { balances: { [testId('amex-mr')]: 75000, [testId('chase-ur')]: 125000.9, bad: -1 }, cursor: 'c1' },
    }

    const res = await sync({ account_id: id })
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('ok')

    const snapshots = await db.select().from(balanceSnapshots)
    expect(snapshots.map((s) => [s.programId, s.balance]).sort()).toEqual([
      [testId('amex-mr'), 75000],
      [testId('chase-ur'), 125000],
    ].sort())
    const [account] = await db.select().from(connectedAccounts)
    expect(account).toMatchObject({ syncStatus: 'ok', lastError: null })
    expect(account.lastSyncedAt).not.toBeNull()
    const [audit] = await db.select().from(connectorAuditLog)
    expect(audit).toMatchObject({ eventType: 'sync', metadata: expect.objectContaining({ outcome: 'ok' }) })
  })

  it('marks expired credentials and provider errors on the account', async () => {
    const id = await seedConnectedAccount(db, pat)
    mockSyncOutcome = { status: 'auth_error', message: 'Token expired' }
    const authRes = await (await sync({ account_id: id })).json()
    expect(authRes.status).toBe('auth_error')
    let [account] = await db.select().from(connectedAccounts)
    expect(account).toMatchObject({ status: 'expired', errorCode: 'auth_error' })

    await db.update(connectedAccounts).set({ status: 'active' })
    mockSyncOutcome = { status: 'error', errorCode: 'rate_limit', message: 'Slow down', attempts: 3 }
    const errRes = await (await sync({ account_id: id })).json()
    expect(errRes).toMatchObject({ status: 'error', errorCode: 'rate_limit', attempts: 3 })
    ;[account] = await db.select().from(connectedAccounts)
    expect(account).toMatchObject({ syncStatus: 'error', errorCode: 'rate_limit', lastError: 'Slow down' })
  })
})
