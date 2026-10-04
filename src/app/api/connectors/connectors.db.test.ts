// @vitest-environment node
// /api/connectors (list/create), /api/connectors/[id] (delete),
// /api/connectors/[id]/balances and /api/connectors/disconnect against Postgres.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { balanceSnapshots, connectedAccounts, connectorAuditLog } from '@/lib/db/schema'
import {
  createTestDb, seedConnectedAccount, seedPrograms, seedUser, sessionFor, testId,
  type SeededUser, type TestDb,
} from '@/test/utils/test-db'
import { GET as listAccounts, POST as createAccount } from './route'
import { DELETE as deleteAccount } from './[id]/route'
import { GET as getBalances } from './[id]/balances/route'
import { POST as disconnect } from './disconnect/route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))

let db: TestDb
let pat: SeededUser
let sam: SeededUser

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const json = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(`https://pointsmax.com${url}`, { method, body: typeof body === 'string' ? body : JSON.stringify(body) })
const auditEvents = async () =>
  (await db.select().from(connectorAuditLog)).map((e) => ({ type: e.eventType, metadata: e.metadata }))

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
  pat = await seedUser(db, 'pat')
  sam = await seedUser(db, 'sam')
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(pat))
})

afterAll(() => setDbForTesting(null))

describe('GET/POST /api/connectors', () => {
  it('requires a session', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect((await listAccounts()).status).toBe(401)
    expect((await createAccount(json('/api/connectors', {}))).status).toBe(401)
  })

  it('lists only the caller’s accounts, with freshness and without vault references', async () => {
    await seedConnectedAccount(db, pat, { lastSyncedAt: new Date().toISOString() })
    await seedConnectedAccount(db, pat, { provider: 'chase' })
    await seedConnectedAccount(db, sam)

    const body = await (await listAccounts()).json()
    expect(body.accounts).toHaveLength(2)
    const byProvider = Object.fromEntries(body.accounts.map((a: { provider: string }) => [a.provider, a]))
    expect(byProvider.amex.freshness).toBe('fresh')
    expect(byProvider.chase.freshness).toBe('never')
    expect(body.accounts[0]).not.toHaveProperty('token_vault_ref')
  })

  it('validates input', async () => {
    const base = { provider: 'amex', display_name: 'Amex', token_vault_ref: 'v', scopes: ['balances'] }
    expect((await createAccount(json('/api/connectors', { ...base, provider: 'nope' }))).status).toBe(400)
    expect((await createAccount(json('/api/connectors', { ...base, display_name: ' ' }))).status).toBe(400)
    expect((await createAccount(json('/api/connectors', { ...base, scopes: [] }))).status).toBe(400)
    expect((await createAccount(json('/api/connectors', 'not json'))).status).toBe(400)
  })

  it('creates an account, records a connect audit event, and rejects duplicates', async () => {
    const body = { provider: 'amex', display_name: ' My Amex ', token_vault_ref: 'vault:1', scopes: ['balances', 'profile'] }
    const res = await createAccount(json('/api/connectors', body))
    expect(res.status).toBe(201)
    const { account } = await res.json()
    expect(account).toMatchObject({ provider: 'amex', display_name: 'My Amex', status: 'active', sync_status: 'pending', freshness: 'never' })
    expect(account).not.toHaveProperty('token_vault_ref')

    const [row] = await db.select().from(connectedAccounts)
    expect(row).toMatchObject({ userId: pat.userId, tokenVaultRef: 'vault:1', scopes: 'balances profile' })
    expect(await auditEvents()).toEqual([expect.objectContaining({ type: 'connect' })])

    expect((await createAccount(json('/api/connectors', body))).status).toBe(409)
  })
})

describe('DELETE /api/connectors/[id]', () => {
  it('returns 404 for another user’s or a malformed account id', async () => {
    const samAccount = await seedConnectedAccount(db, sam)
    expect((await deleteAccount(json('/x', {}, 'DELETE'), params(samAccount))).status).toBe(404)
    expect((await deleteAccount(json('/x', {}, 'DELETE'), params('not-a-uuid'))).status).toBe(404)
    expect(await db.select().from(connectedAccounts)).toHaveLength(1)
  })

  it('deletes the account and its snapshots, keeping a delete audit event', async () => {
    await seedPrograms(db, [{ key: 'amex-mr' }])
    const id = await seedConnectedAccount(db, pat, { status: 'active' })
    await db.insert(balanceSnapshots).values({ connectedAccountId: id, userId: pat.userId, programId: testId('amex-mr'), balance: 10 })

    const res = await deleteAccount(json('/x', {}, 'DELETE'), params(id))
    expect(res.status).toBe(204)
    expect(await db.select().from(connectedAccounts)).toHaveLength(0)
    expect(await db.select().from(balanceSnapshots)).toHaveLength(0)
    expect(await auditEvents()).toEqual([
      { type: 'delete', metadata: { previousStatus: 'active', displayName: 'My Amex' } },
    ])
  })

  it('still deletes when the audit log cannot be written', async () => {
    const id = await seedConnectedAccount(db, pat)
    await db.execute(sql`drop table connector_audit_log`)
    expect((await deleteAccount(json('/x', {}, 'DELETE'), params(id))).status).toBe(204)
  })
})

describe('GET /api/connectors/[id]/balances', () => {
  it('returns newest snapshots first, capped by limit, for the owner only', async () => {
    await seedPrograms(db, [{ key: 'amex-mr' }])
    const id = await seedConnectedAccount(db, pat)
    await db.insert(balanceSnapshots).values(
      Array.from({ length: 12 }, (_, i) => ({
        connectedAccountId: id,
        userId: pat.userId,
        programId: testId('amex-mr'),
        balance: i,
        fetchedAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      })),
    )
    const get = (q = '') => getBalances(new NextRequest(`https://pointsmax.com/api/connectors/${id}/balances${q}`), params(id))

    const defaults = await (await get()).json()
    expect(defaults.balances).toHaveLength(10)
    expect(defaults.balances[0].balance).toBe(11)
    expect((await (await get('?limit=3')).json()).balances).toHaveLength(3)
    expect((await (await get('?limit=500')).json()).balances).toHaveLength(12)

    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(sam))
    expect((await get()).status).toBe(404)
  })
})

describe('POST /api/connectors/disconnect', () => {
  it('validates the body', async () => {
    expect((await disconnect(json('/api/connectors/disconnect', 'nope'))).status).toBe(400)
    expect((await disconnect(json('/api/connectors/disconnect', {}))).status).toBe(400)
    expect((await disconnect(json('/api/connectors/disconnect', { account_id: ' ' }))).status).toBe(400)
  })

  it('revokes the account, destroys the vault reference and records an audit event', async () => {
    const id = await seedConnectedAccount(db, pat)
    const res = await disconnect(json('/api/connectors/disconnect', { account_id: id }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })

    const [row] = await db.select().from(connectedAccounts)
    expect(row).toMatchObject({ status: 'revoked', tokenVaultRef: 'REVOKED', syncStatus: 'error' })
    expect(await auditEvents()).toEqual([{ type: 'disconnect', metadata: { previousStatus: 'active' } }])

    expect((await disconnect(json('/api/connectors/disconnect', { account_id: id }))).status).toBe(400)
  })

  it('cannot disconnect another user’s account', async () => {
    const samAccount = await seedConnectedAccount(db, sam)
    expect((await disconnect(json('/api/connectors/disconnect', { account_id: samAccount }))).status).toBe(404)
    const [row] = await db.select().from(connectedAccounts)
    expect(row.status).toBe('active')
  })
})
