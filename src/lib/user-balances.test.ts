// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getCatalogProgramBySlug } from '@/lib/catalog'
import { setDbForTesting } from '@/lib/db/client'
import { userBalances } from '@/lib/db/schema'
import { createTestDb, seedUser, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { loadUnifiedBalancesByUser } from './user-balances'

const US_PROGRAM = getCatalogProgramBySlug('chase-ur')!.id
const INDIA_PROGRAM = getCatalogProgramBySlug('hdfc-millennia')!.id

let db: TestDb
let pat: SeededUser
let sam: SeededUser

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
  pat = await seedUser(db, 'pat')
  sam = await seedUser(db, 'sam')
})

afterAll(() => setDbForTesting(null))

describe('loadUnifiedBalancesByUser', () => {
  it("returns each user's saved balances, and an empty list for users with none", async () => {
    await db.insert(userBalances).values([
      { userId: pat.userId, programId: US_PROGRAM, balance: 111000, updatedAt: new Date().toISOString() },
      { userId: pat.userId, programId: INDIA_PROGRAM, balance: 50000, updatedAt: '2020-01-01T00:00:00Z' },
    ])

    const result = await loadUnifiedBalancesByUser([pat.userId, sam.userId])

    expect(result.get(pat.userId)).toEqual(expect.arrayContaining([
      expect.objectContaining({ program_id: US_PROGRAM, balance: 111000, source: 'manual', confidence: 'high', is_stale: false, connected_account_id: null }),
      expect.objectContaining({ program_id: INDIA_PROGRAM, balance: 50000, confidence: 'low', is_stale: true }),
    ]))
    expect(result.get(sam.userId)).toEqual([])
  })

  it('filters balances by region when requested', async () => {
    await db.insert(userBalances).values([
      { userId: pat.userId, programId: US_PROGRAM, balance: 1000 },
      { userId: pat.userId, programId: INDIA_PROGRAM, balance: 2000 },
    ])

    const result = await loadUnifiedBalancesByUser([pat.userId], 'IN')
    expect(result.get(pat.userId)?.map((b) => b.program_id)).toEqual([INDIA_PROGRAM])
  })

  it('returns nothing without querying when no user ids are given', async () => {
    setDbForTesting(null) // would throw if it touched the database
    expect((await loadUnifiedBalancesByUser(['', ''])).size).toBe(0)
  })
})
