// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { BalanceInput } from '@/types/database'
import { calculateRedemptions } from './calculate'
import { setDbForTesting } from '@/lib/db/client'
import { redemptionOptions, transferBonuses } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedTransfer, testId, type TestDb } from '@/test/utils/test-db'

let db: TestDb

async function seedDefaultCatalog() {
  await seedPrograms(db, [
    { key: 'chase-ur', name: 'Chase Ultimate Rewards', type: 'transferable_points', cpp: 2.0 },
    { key: 'hyatt', name: 'World of Hyatt', type: 'hotel_points', cpp: 1.8 },
    { key: 'cash-only', name: 'Cash Only', type: 'cashback', cpp: 1.0 },
    { key: 'united', name: 'United MileagePlus', type: 'airline_miles', cpp: 1.2 },
  ])
  await seedTransfer(db, 'chase-ur', 'hyatt')
  await seedTransfer(db, 'chase-ur', 'united')
  await db.insert(redemptionOptions).values([
    { programId: testId('chase-ur'), category: 'travel_portal', cppCents: 1.5, label: 'Chase Travel Portal' },
    { programId: testId('chase-ur'), category: 'cashback', cppCents: 1.0, label: 'Cash Back' },
    { programId: testId('cash-only'), category: 'cashback', cppCents: 1.0, label: 'Cash Back' },
  ])
}

const balance = (key: string, amount: number): BalanceInput[] => [{ program_id: testId(key), amount }]

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
})

afterAll(() => setDbForTesting(null))

describe('calculateRedemptions', () => {
  it('ranks best option and computes totals for a basic transferable balance', async () => {
    await seedDefaultCatalog()
    const result = await calculateRedemptions(balance('chase-ur', 10000))

    expect(result.total_cash_value_cents).toBe(10000)
    expect(result.total_optimal_value_cents).toBe(18000)
    expect(result.value_left_on_table_cents).toBe(8000)
    expect(result.cash_baseline_available).toBe(true)

    expect(result.results.length).toBe(4)
    expect(result.results[0].label).toBe('Transfer to World of Hyatt')
    expect(result.results[0].is_best).toBe(true)
    expect(result.results[0].cpp_cents).toBeCloseTo(1.8, 5)
  })

  it('throws when a required query fails', async () => {
    await seedDefaultCatalog()
    await db.execute(sql`drop view latest_valuations`)
    await expect(calculateRedemptions(balance('chase-ur', 10000))).rejects.toThrow()
  })

  it('shows effective cpp for lossy transfer ratios', async () => {
    await seedDefaultCatalog()
    await db.execute(sql`update transfer_partners set ratio_from = 5, ratio_to = 4 where id = ${testId('tp:chase-ur->hyatt')}`)
    await db.execute(sql`update transfer_partners set is_active = false where id = ${testId('tp:chase-ur->united')}`)

    const result = await calculateRedemptions(balance('chase-ur', 10000))
    const transferResult = result.results.find((row) => row.label === 'Transfer to World of Hyatt')

    expect(transferResult).toBeDefined()
    expect(transferResult?.points_out).toBe(8000)
    expect(transferResult?.cpp_cents).toBeCloseTo(1.44, 5)
    expect(result.results[0].label).toBe('Chase Travel Portal')
  })

  it('applies verified active transfer bonuses but not unverified ones', async () => {
    await seedDefaultCatalog()
    const today = new Date().toISOString().slice(0, 10)
    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    await db.insert(transferBonuses).values([
      { transferPartnerId: testId('tp:chase-ur->united'), bonusPct: 50, startDate: today, endDate: nextWeek, isVerified: false, autoDetected: true },
      { transferPartnerId: testId('tp:chase-ur->hyatt'), bonusPct: 10, startDate: today, endDate: nextWeek, isVerified: true },
    ])

    const result = await calculateRedemptions(balance('chase-ur', 10000))
    const hyatt = result.results.find((r) => r.to_program?.slug === 'hyatt')
    const united = result.results.find((r) => r.to_program?.slug === 'united')

    expect(hyatt?.points_out).toBe(11000)
    expect(hyatt?.active_bonus_pct).toBe(10)
    expect(united?.points_out).toBe(10000)
    expect(united?.active_bonus_pct).toBeUndefined()
  })

  it('treats cashback-only programs as having a valid optimal and cash baseline', async () => {
    await seedDefaultCatalog()
    const result = await calculateRedemptions(balance('cash-only', 10000))

    expect(result.total_cash_value_cents).toBe(10000)
    expect(result.total_optimal_value_cents).toBe(10000)
    expect(result.value_left_on_table_cents).toBe(0)
    expect(result.cash_baseline_available).toBe(true)
    expect(result.results[0].category).toBe('cashback')
    expect(result.results[0].is_best).toBe(true)
  })

  it('finds higher-value multi-hop transfer paths', async () => {
    await seedDefaultCatalog()
    await seedPrograms(db, [
      { key: 'aeroplan', name: 'Air Canada Aeroplan', type: 'airline_miles' },
      { key: 'ana', name: 'ANA Mileage Club', type: 'airline_miles', cpp: 2.6 },
    ])
    await seedTransfer(db, 'chase-ur', 'aeroplan')
    await seedTransfer(db, 'aeroplan', 'ana', { maxHrs: 24, instant: false })

    const result = await calculateRedemptions(balance('chase-ur', 10000))
    const best = result.results[0]

    expect(best.label).toBe('Transfer to ANA Mileage Club via Air Canada Aeroplan')
    expect(best.is_instant).toBe(false)
    expect(best.transfer_time_max_hrs).toBe(24)
    expect(best.total_value_cents).toBe(26000)
    expect(best.is_best).toBe(true)
  })

  it('returns null cash baseline totals when a balance has no direct cash option', async () => {
    await seedDefaultCatalog()
    const result = await calculateRedemptions(balance('united', 10000))

    expect(result.total_cash_value_cents).toBeNull()
    expect(result.value_left_on_table_cents).toBeNull()
    expect(result.cash_baseline_available).toBe(false)
    expect(result.total_optimal_value_cents).toBe(0)
  })

  it('converts a cents-valued global target into paise for an Indian currency', async () => {
    await seedPrograms(db, [
      { key: 'amex-india-mr', name: 'Amex MR India', geography: 'IN', cpp: 75, effectiveDate: '2026-03-06' },
      { key: 'marriott', name: 'Marriott Bonvoy', type: 'hotel_points', geography: 'global', cpp: 0.75 },
    ])
    await seedTransfer(db, 'amex-india-mr', 'marriott', { maxHrs: 72, instant: false })

    const result = await calculateRedemptions(balance('amex-india-mr', 10000))
    const marriott = result.results.find((r) => r.to_program?.slug === 'marriott')

    // 0.75 US cents = 0.75 * 88 = 66 paise per point
    expect(marriott?.cpp_cents).toBeCloseTo(66, 5)
    expect(marriott?.total_value_cents).toBeCloseTo(660000, 5)
  })

  it('labels results with the review dates of the valuations used', async () => {
    await seedPrograms(db, [
      { key: 'chase-ur', name: 'Chase Ultimate Rewards', cpp: 2.0, effectiveDate: '2025-01-15' },
      { key: 'hyatt', name: 'World of Hyatt', type: 'hotel_points', cpp: 1.8, effectiveDate: '2026-04-09' },
    ])
    await seedTransfer(db, 'chase-ur', 'hyatt')

    const result = await calculateRedemptions(balance('chase-ur', 10000))
    expect(result.valuation_source).toBe('Valuations reviewed Jan 2025 – Apr 2026')
  })
})
