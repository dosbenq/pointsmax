// @vitest-environment node
// ============================================================
// Lifecycle integration test for the Connected Wallet APIs,
// against a real (in-memory) Postgres:
// 1. Create (POST /api/connectors)
// 2. List (GET /api/connectors)
// 3. Sync (POST /api/connectors/sync)
// 4. Disconnect (POST /api/connectors/disconnect)
// 5. Delete (DELETE /api/connectors/[id])
// ============================================================

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { balanceSnapshots, connectedAccounts, connectorAuditLog } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedUser, sessionFor, type TestDb } from '@/test/utils/test-db'
import { GET as listAccounts, POST as createAccount } from './route'
import { POST as syncAccount } from './sync/route'
import { POST as disconnectAccount } from './disconnect/route'
import { DELETE as deleteAccount } from './[id]/route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/connectors/token-vault', () => ({
  decryptToken: vi.fn().mockReturnValue('mock-decrypted-token'),
  encryptToken: vi.fn().mockReturnValue('mock-vault-ref'),
}))
vi.mock('@/lib/connectors/sync-orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/connectors/sync-orchestrator')>()
  return {
    ...actual,
    runAccountSync: vi.fn().mockImplementation(async (_adapter, context, persistence) => {
      const { testId: id } = await import('@/test/utils/test-db')
      const result = { balances: { [id('amex-mr')]: 100 }, cursor: null }
      await persistence.markSyncing(context.account.id)
      await persistence.markSuccess(context.account.id, result)
      return { status: 'ok', result }
    }),
  }
})
vi.mock('@/lib/connectors/connector-registry', () => ({
  connectorRegistry: {
    get: vi.fn().mockReturnValue({ providerId: 'amex', displayName: 'American Express', fetchBalance: vi.fn(), validateCredentials: vi.fn() }),
  },
}))

let db: TestDb

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [{ key: 'amex-mr' }])
  const user = await seedUser(db, 'pat', { tier: 'premium' })
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
})

afterAll(() => setDbForTesting(null))

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

describe('Connected Wallet Lifecycle', () => {
  it('performs a full account lifecycle correctly', async () => {
    // 1. Create
    const createRes = await createAccount(new NextRequest('http://localhost/api/connectors', post({
      provider: 'amex', display_name: 'Amex', token_vault_ref: 'vault:1', scopes: ['balances'],
    })))
    expect(createRes.status).toBe(201)
    const { account } = await createRes.json()
    expect(account.sync_status).toBe('pending')

    // 2. List
    const { accounts } = await (await listAccounts()).json()
    expect(accounts.map((a: { id: string }) => a.id)).toEqual([account.id])
    expect(accounts[0].freshness).toBe('never')

    // 3. Sync
    const syncRes = await syncAccount(new NextRequest('http://localhost/api/connectors/sync', post({ account_id: account.id })))
    expect(syncRes.status).toBe(200)
    expect((await syncRes.json()).status).toBe('ok')
    let [row] = await db.select().from(connectedAccounts)
    expect(row.syncStatus).toBe('ok')
    expect(row.lastSyncedAt).not.toBeNull()
    expect(await db.select().from(balanceSnapshots)).toHaveLength(1)

    // 4. Disconnect
    const discRes = await disconnectAccount(new NextRequest('http://localhost/api/connectors/disconnect', post({ account_id: account.id })))
    expect(discRes.status).toBe(200)
    ;[row] = await db.select().from(connectedAccounts)
    expect(row).toMatchObject({ status: 'revoked', tokenVaultRef: 'REVOKED' })

    // 5. Delete
    const delRes = await deleteAccount(new NextRequest(`http://localhost/api/connectors/${account.id}`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: account.id }),
    })
    expect(delRes.status).toBe(204)
    expect(await db.select().from(connectedAccounts)).toHaveLength(0)
    expect(await db.select().from(balanceSnapshots)).toHaveLength(0)

    const events = (await db.select().from(connectorAuditLog)).map((e) => e.eventType)
    expect(events).toEqual(['connect', 'sync', 'disconnect', 'delete'])
  })
})
