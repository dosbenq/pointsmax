// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { balanceSnapshots, connectedAccounts, userBalances } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedUser, sessionFor, testId, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { GET, POST } from './route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))

let db: TestDb
let user: SeededUser

async function seedWallet() {
  await db.insert(userBalances).values({
    userId: user.userId,
    programId: testId('chase-ur'),
    balance: 120000,
    updatedAt: '2026-03-06T11:30:00.000Z',
  })
  await db.insert(connectedAccounts).values({
    id: testId('acct-1'),
    userId: user.userId,
    provider: 'amex',
    tokenVaultRef: 'vault:1',
    syncStatus: 'ok',
    lastSyncedAt: '2026-03-06T11:00:00.000Z',
  })
  await db.insert(balanceSnapshots).values([
    { connectedAccountId: testId('acct-1'), userId: user.userId, programId: testId('amex-mr'), balance: 90000, fetchedAt: '2026-03-06T10:00:00.000Z' },
    // Older connector reading for Chase: the newer manual balance wins.
    { connectedAccountId: testId('acct-1'), userId: user.userId, programId: testId('chase-ur'), balance: 100000, fetchedAt: '2026-03-06T09:00:00.000Z' },
    { connectedAccountId: testId('acct-1'), userId: user.userId, programId: testId('air-india'), balance: 10000, fetchedAt: '2026-03-06T10:00:00.000Z' },
  ])
}

describe('/api/user/balances', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-06T12:00:00.000Z'))
    db = await createTestDb()
    setDbForTesting(db)
    await seedPrograms(db, [
      { key: 'chase-ur', geography: 'US' },
      { key: 'amex-mr', geography: 'US' },
      { key: 'air-india', type: 'airline_miles', geography: 'IN' },
    ])
    user = await seedUser(db, 'pat')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  afterAll(() => setDbForTesting(null))

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)

    const res = await GET(new NextRequest('http://localhost/api/user/balances'))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('merges manual balances with latest connected snapshots and preserves metadata', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
    await seedWallet()

    const res = await GET(new NextRequest('http://localhost/api/user/balances'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.balances).toHaveLength(3)
    expect(body.balances).toContainEqual(expect.objectContaining({
      program_id: testId('chase-ur'),
      balance: 120000,
      source: 'manual',
      confidence: 'high',
      connected_account_id: null,
    }))
    expect(body.balances).toContainEqual(expect.objectContaining({
      program_id: testId('amex-mr'),
      balance: 90000,
      source: 'connector',
      sync_status: 'ok',
      connected_account_id: testId('acct-1'),
    }))
  })

  it('filters unified balances by region when a region parameter is provided', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
    await seedWallet()

    const res = await GET(new NextRequest('http://localhost/api/user/balances?region=IN'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.balances).toEqual([
      expect.objectContaining({ program_id: testId('air-india'), source: 'connector' }),
    ])
  })

  it('upserts posted balances for the signed-in user only', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
    const other = await seedUser(db, 'other')
    await db.insert(userBalances).values({ userId: other.userId, programId: testId('chase-ur'), balance: 5 })

    const post = (balance: number) => POST(new NextRequest('http://localhost/api/user/balances', {
      method: 'POST',
      body: JSON.stringify({ balances: [{ program_id: testId('chase-ur'), balance }] }),
    }))

    expect((await post(12345)).status).toBe(200)
    expect((await post(54321)).status).toBe(200)

    const rows = await db.select().from(userBalances)
    expect(rows.map((r) => [r.userId, r.balance]).sort()).toEqual([
      [other.userId, 5],
      [user.userId, 54321],
    ].sort())
  })

  it('rejects payloads without valid balances', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
    const res = await POST(new NextRequest('http://localhost/api/user/balances', {
      method: 'POST',
      body: JSON.stringify({ balances: [{ program_id: 1, balance: 'x' }] }),
    }))
    expect(res.status).toBe(400)
  })
})
