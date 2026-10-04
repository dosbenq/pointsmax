// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { setDbForTesting } from '@/lib/db/client'
import { cardEarningRates, cards } from '@/lib/db/schema'
import { createTestDb, seedPrograms, testId, type TestDb } from '@/test/utils/test-db'

const logErrorMock = vi.fn()

vi.mock('@/lib/logger', () => ({
  logError: logErrorMock,
}))

vi.mock('@/lib/api-security', () => ({
  enforceRateLimit: vi.fn(async () => null),
}))

const { GET } = await import('./route')

let db: TestDb

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [
    { key: 'program-one', name: 'Program One', geography: 'US', cpp: 2 },
    { key: 'india-program', name: 'India Program', geography: 'IN', cpp: 120 },
  ])
})

afterAll(() => setDbForTesting(null))

describe('GET /api/cards', () => {
  it('returns 500 when the base cards query fails', async () => {
    await db.execute(sql`drop table card_earning_rates`)
    await db.execute(sql`drop table cards cascade`)

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=US'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(logErrorMock).toHaveBeenCalledWith(
      'cards_repository_fetch_failed',
      expect.objectContaining({ cards_error: expect.any(String) }),
    )
  })

  it('returns 500 when the earning-rates query fails', async () => {
    await db.insert(cards).values({ id: testId('card-1'), name: 'Card One', issuer: 'Issuer', programId: testId('program-one') })
    await db.execute(sql`drop table card_earning_rates`)

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=US'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(logErrorMock).toHaveBeenCalledWith(
      'cards_repository_fetch_failed',
      expect.objectContaining({ metadata_error: expect.any(String) }),
    )
  })

  it('returns normalized cards payload with cache headers', async () => {
    await db.insert(cards).values({
      id: testId('card-1'),
      name: 'Card One',
      issuer: 'Issuer',
      annualFeeUsd: 95,
      signupBonusPts: 50000,
      signupBonusSpend: 3000,
      programId: testId('program-one'),
      displayOrder: 1,
    })
    await db.insert(cardEarningRates).values({ cardId: testId('card-1'), category: 'dining', earnMultiplier: 3 })

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=US'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600')
    expect(body.cards).toHaveLength(1)
    expect(body.cards[0]).toEqual(
      expect.objectContaining({
        id: testId('card-1'),
        geography: 'US',
        currency: 'USD',
        earn_unit: '1_dollar',
        apply_url: null,
        program_name: 'Program One',
        program_slug: 'program-one',
        cpp_cents: 2,
      }),
    )
    expect(body.cards[0].earning_rates).toEqual(expect.objectContaining({ dining: 3, groceries: 1, travel: 1 }))
  })

  it('returns india valuation units exactly as stored in the database (paise)', async () => {
    await db.insert(cards).values({
      id: testId('card-in-1'),
      name: 'India Card',
      issuer: 'Issuer',
      annualFeeUsd: 5000,
      programId: testId('india-program'),
      currency: 'INR',
      earnUnit: '100_inr',
      geography: 'IN',
    })
    await db.insert(cardEarningRates).values({ cardId: testId('card-in-1'), category: 'dining', earnMultiplier: 3.33 })

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=IN'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.geography).toBe('IN')
    expect(body.cards[0]).toEqual(
      expect.objectContaining({ geography: 'IN', currency: 'INR', earn_unit: '100_inr', cpp_cents: 120 }),
    )
    expect(body.cards[0].earning_rates.dining).toBe(3.33)
  })
})
