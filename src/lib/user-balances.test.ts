// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setDbForTesting } from '@/lib/db/client'
import { balanceSnapshots, connectedAccounts, userBalances } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedUser, testId, type TestDb } from '@/test/utils/test-db'
import { loadUnifiedBalancesByUser } from './user-balances'

let db: TestDb

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [
    { key: 'chase-ur', geography: 'US' },
    { key: 'marriott', type: 'hotel_points', geography: 'global' },
    { key: 'hdfc-smartbuy', geography: 'IN' },
  ])
})

afterAll(() => setDbForTesting(null))

describe('loadUnifiedBalancesByUser', () => {
  it('returns an empty map for no users', async () => {
    expect((await loadUnifiedBalancesByUser([])).size).toBe(0)
  })

  it('prefers manual balances over connector snapshots and keeps the latest snapshot per programme', async () => {
    const a = await seedUser(db, 'a')
    const b = await seedUser(db, 'b')
    await db.insert(connectedAccounts).values({ id: testId('acct'), userId: a.userId, provider: 'amex', tokenVaultRef: 'v', syncStatus: 'ok' })
    await db.insert(balanceSnapshots).values([
      { connectedAccountId: testId('acct'), userId: a.userId, programId: testId('chase-ur'), balance: 1, fetchedAt: '2026-01-01T00:00:00Z' },
      { connectedAccountId: testId('acct'), userId: a.userId, programId: testId('marriott'), balance: 500, fetchedAt: '2026-01-02T00:00:00Z' },
      { connectedAccountId: testId('acct'), userId: a.userId, programId: testId('marriott'), balance: 400, fetchedAt: '2026-01-01T00:00:00Z' },
    ])
    await db.insert(userBalances).values([
      { userId: a.userId, programId: testId('chase-ur'), balance: 120000 },
      { userId: b.userId, programId: testId('hdfc-smartbuy'), balance: 7000 },
    ])

    const result = await loadUnifiedBalancesByUser([a.userId, b.userId, a.userId])
    const forA = Object.fromEntries((result.get(a.userId) ?? []).map((x) => [x.program_id, x]))
    expect(forA[testId('chase-ur')]).toMatchObject({ balance: 120000, source: 'manual' })
    expect(forA[testId('marriott')]).toMatchObject({ balance: 500, source: 'connector', sync_status: 'ok' })
    expect(result.get(b.userId)?.map((x) => x.balance)).toEqual([7000])
  })

  it('filters balances by region when requested (global programmes count for both)', async () => {
    const a = await seedUser(db, 'a')
    await db.insert(userBalances).values([
      { userId: a.userId, programId: testId('chase-ur'), balance: 1 },
      { userId: a.userId, programId: testId('marriott'), balance: 2 },
      { userId: a.userId, programId: testId('hdfc-smartbuy'), balance: 3 },
    ])
    const india = await loadUnifiedBalancesByUser([a.userId], 'IN')
    expect(india.get(a.userId)?.map((x) => x.balance).sort()).toEqual([2, 3])
  })
})
