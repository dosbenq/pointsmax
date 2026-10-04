// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ChartHotelProvider } from './chart-provider'
import { setDbForTesting } from '@/lib/db/client'
import { hotelAwardCharts, hotelPrograms } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedTransfer, testId, type TestDb } from '@/test/utils/test-db'

let db: TestDb

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [
    { key: 'chase-ur', name: 'Chase Ultimate Rewards' },
    { key: 'hyatt', name: 'World of Hyatt', type: 'hotel_points' },
  ])
  await seedTransfer(db, 'chase-ur', 'hyatt')
  await db.insert(hotelPrograms).values({
    id: testId('hotel-hyatt'),
    slug: 'hyatt',
    name: 'World of Hyatt',
    chain: 'Hyatt',
    bookingUrl: 'https://world.hyatt.com/content/gp/en/rewards.html',
    colorHex: '#B49970',
  })
  await db.insert(hotelAwardCharts).values([
    {
      programId: testId('hotel-hyatt'),
      destinationRegion: 'asia_pacific',
      tierLabel: 'Category 4',
      tierNumber: 4,
      pointsOffPeak: 12000,
      pointsStandard: 15000,
      pointsPeak: 18000,
      estimatedCashUsd: 320,
    },
    {
      programId: testId('hotel-hyatt'),
      destinationRegion: 'europe',
      tierLabel: 'Category 4',
      tierNumber: 4,
      pointsStandard: 15000,
      estimatedCashUsd: 280,
    },
  ])
})

afterAll(() => setDbForTesting(null))

describe('ChartHotelProvider', () => {
  it('returns ranked hotel results with transfer details', async () => {
    const results = await new ChartHotelProvider().search({
      destination_region: 'asia_pacific',
      check_in: '2026-04-01',
      check_out: '2026-04-04',
      balances: [{ program_id: testId('chase-ur'), amount: 50000 }],
    })

    expect(results).toHaveLength(1)
    expect(results[0].program_slug).toBe('hyatt')
    expect(results[0].nights).toBe(3)
    expect(results[0].points_standard_total).toBe(45000)
    expect(results[0].is_reachable).toBe(true)
    expect(results[0].transfer_chain).toContain('Chase Ultimate Rewards')
    expect(results[0].cpp_cents).toBeGreaterThan(2)
  })

  it('still returns chart results when the wallet cannot reach the programme', async () => {
    const results = await new ChartHotelProvider().search({
      destination_region: 'europe',
      check_in: '2026-04-01',
      check_out: '2026-04-02',
      balances: [],
    })

    expect(results).toHaveLength(1)
    expect(results[0].is_reachable).toBe(false)
    expect(results[0].transfer_chain).toBeNull()
  })
})
