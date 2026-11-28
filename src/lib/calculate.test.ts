// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BalanceInput } from '@/types/database'
import { setDbForTesting } from '@/lib/db/client'
import { transferBonuses } from '@/lib/db/schema'
import { createTestDb, type TestDb } from '@/test/utils/test-db'

const TP_CHASE_HYATT = '0b5f3c1e-0000-4000-8000-000000000001'
const TP_CHASE_UNITED = '0b5f3c1e-0000-4000-8000-000000000002'

const mockData: Record<string, unknown[]> = {
  latest_valuations: [
    { program_id: 'chase-ur', cpp_cents: 2.0, program_name: 'Chase Ultimate Rewards', program_slug: 'chase-ur', program_type: 'transferable_points' },
    { program_id: 'hyatt', cpp_cents: 1.8, program_name: 'World of Hyatt', program_slug: 'hyatt', program_type: 'hotel_points' },
    { program_id: 'cash-only', cpp_cents: 1.0, program_name: 'Cash Only', program_slug: 'cash-only', program_type: 'cashback' },
    { program_id: 'united', cpp_cents: 1.2, program_name: 'United MileagePlus', program_slug: 'united', program_type: 'airline_miles' },
  ],
  transfer_partners: [
    { id: TP_CHASE_HYATT, from_program_id: 'chase-ur', to_program_id: 'hyatt', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
    { id: TP_CHASE_UNITED, from_program_id: 'chase-ur', to_program_id: 'united', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
  ],
  redemption_options: [
    { program_id: 'chase-ur', category: 'travel_portal', cpp_cents: 1.5, label: 'Chase Travel Portal' },
    { program_id: 'chase-ur', category: 'cashback', cpp_cents: 1.0, label: 'Cash Back' },
    { program_id: 'cash-only', category: 'cashback', cpp_cents: 1.0, label: 'Cash Back' },
  ],
  programs: [
    { id: 'chase-ur', name: 'Chase Ultimate Rewards', short_name: 'Chase UR', slug: 'chase-ur', color_hex: '#1c4d8c', type: 'transferable_points' },
    { id: 'hyatt', name: 'World of Hyatt', short_name: 'Hyatt', slug: 'hyatt', color_hex: '#b49970', type: 'hotel_points' },
    { id: 'cash-only', name: 'Cash Only', short_name: 'Cash', slug: 'cash-only', color_hex: '#22aa44', type: 'cashback' },
    { id: 'united', name: 'United MileagePlus', short_name: 'United', slug: 'united', color_hex: '#002244', type: 'airline_miles' },
  ],
}

let readyError: Error | null = null
let db: TestDb

// Reference data comes from the catalog; feed the engine small synthetic fixtures.
vi.mock('@/lib/catalog', () => ({
  getCatalogLatestValuations: () => mockData.latest_valuations,
  getCatalogTransferPartners: () => mockData.transfer_partners,
  getCatalogRedemptionOptions: () => mockData.redemption_options,
  getCatalogPrograms: () => mockData.programs,
}))

// Only time-bound transfer bonuses still come from the database.
vi.mock('@/lib/db/ready', () => ({
  ensureDatabaseReady: vi.fn(async () => {
    if (readyError) throw readyError
  }),
}))

const today = new Date().toISOString().slice(0, 10)
const daysFromToday = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

async function addBonus(values: { transferPartnerId: string; bonusPct: number; isVerified?: boolean; startDate?: string; endDate?: string }) {
  await db.insert(transferBonuses).values({
    isVerified: true,
    startDate: daysFromToday(-1),
    endDate: daysFromToday(7),
    ...values,
  })
}

vi.mock('@/lib/logger', () => ({ logWarn: vi.fn(), logError: vi.fn(), logInfo: vi.fn() }))

const { calculateRedemptions } = await import('./calculate')

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
})

afterEach(() => {
  setDbForTesting(null)
  readyError = null
  mockData.latest_valuations = [
    { program_id: 'chase-ur', cpp_cents: 2.0, program_name: 'Chase Ultimate Rewards', program_slug: 'chase-ur', program_type: 'transferable_points' },
    { program_id: 'hyatt', cpp_cents: 1.8, program_name: 'World of Hyatt', program_slug: 'hyatt', program_type: 'hotel_points' },
    { program_id: 'cash-only', cpp_cents: 1.0, program_name: 'Cash Only', program_slug: 'cash-only', program_type: 'cashback' },
    { program_id: 'united', cpp_cents: 1.2, program_name: 'United MileagePlus', program_slug: 'united', program_type: 'airline_miles' },
  ]
  mockData.transfer_partners = [
    { id: TP_CHASE_HYATT, from_program_id: 'chase-ur', to_program_id: 'hyatt', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
    { id: TP_CHASE_UNITED, from_program_id: 'chase-ur', to_program_id: 'united', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
  ]
  mockData.programs = [
    { id: 'chase-ur', name: 'Chase Ultimate Rewards', short_name: 'Chase UR', slug: 'chase-ur', color_hex: '#1c4d8c', type: 'transferable_points' },
    { id: 'hyatt', name: 'World of Hyatt', short_name: 'Hyatt', slug: 'hyatt', color_hex: '#b49970', type: 'hotel_points' },
    { id: 'cash-only', name: 'Cash Only', short_name: 'Cash', slug: 'cash-only', color_hex: '#22aa44', type: 'cashback' },
    { id: 'united', name: 'United MileagePlus', short_name: 'United', slug: 'united', color_hex: '#002244', type: 'airline_miles' },
  ]
})

describe('calculateRedemptions', () => {
  it('ranks best option and computes totals for a basic transferable balance', async () => {
    const balances: BalanceInput[] = [{ program_id: 'chase-ur', amount: 10000 }]
    const result = await calculateRedemptions(balances)

    expect(result.total_cash_value_cents).toBe(10000)
    expect(result.total_optimal_value_cents).toBe(18000)
    expect(result.value_left_on_table_cents).toBe(8000)
    expect(result.cash_baseline_available).toBe(true)

    expect(result.results.length).toBe(4)
    expect(result.results[0].label).toBe('Transfer to World of Hyatt')
    expect(result.results[0].is_best).toBe(true)
    expect(result.results[0].cpp_cents).toBeCloseTo(1.8, 5)
  })

  it('applies an active verified transfer bonus', async () => {
    await addBonus({ transferPartnerId: TP_CHASE_HYATT, bonusPct: 30 })
    const result = await calculateRedemptions([{ program_id: 'chase-ur', amount: 10000 }])

    expect(result.results[0].label).toBe('Transfer to World of Hyatt')
    expect(result.total_optimal_value_cents).toBe(23400)
  })

  it('ignores bonuses that are unverified, finished or not started', async () => {
    await addBonus({ transferPartnerId: TP_CHASE_HYATT, bonusPct: 30, isVerified: false })
    await addBonus({ transferPartnerId: TP_CHASE_HYATT, bonusPct: 40, startDate: daysFromToday(-10), endDate: daysFromToday(-1) })
    await addBonus({ transferPartnerId: TP_CHASE_HYATT, bonusPct: 50, startDate: daysFromToday(1), endDate: daysFromToday(9) })
    await addBonus({ transferPartnerId: TP_CHASE_UNITED, bonusPct: 25, startDate: today, endDate: today })

    const result = await calculateRedemptions([{ program_id: 'chase-ur', amount: 10000 }])
    const hyatt = result.results.find((r) => r.label === 'Transfer to World of Hyatt')!
    const united = result.results.find((r) => r.label === 'Transfer to United MileagePlus')!
    expect(hyatt.total_value_cents).toBe(18000)
    expect(united.total_value_cents).toBe(15000) // 1.2¢ × 12,500 miles: a bonus that starts and ends today counts
  })

  it('still calculates (without bonuses) when the database is unreachable', async () => {
    await addBonus({ transferPartnerId: TP_CHASE_HYATT, bonusPct: 30 })
    readyError = new Error('database paused')
    const result = await calculateRedemptions([{ program_id: 'chase-ur', amount: 10000 }])

    expect(result.total_optimal_value_cents).toBe(18000)
    expect(result.results[0].label).toBe('Transfer to World of Hyatt')
  })

  it('shows effective cpp for lossy transfer ratios', async () => {
    mockData.transfer_partners = [
      { id: 'tp-lossy', from_program_id: 'chase-ur', to_program_id: 'hyatt', ratio_from: 5, ratio_to: 4, transfer_time_max_hrs: 0, is_instant: true },
    ]
    const balances: BalanceInput[] = [{ program_id: 'chase-ur', amount: 10000 }]
    const result = await calculateRedemptions(balances)
    const transferResult = result.results.find((row) => row.label === 'Transfer to World of Hyatt')

    expect(transferResult).toBeDefined()
    expect(transferResult?.points_out).toBe(8000)
    expect(transferResult?.cpp_cents).toBeCloseTo(1.44, 5)
    expect(result.results[0].label).toBe('Chase Travel Portal')
  })

  it('treats cashback-only programs as having a valid optimal and cash baseline', async () => {
    const balances: BalanceInput[] = [{ program_id: 'cash-only', amount: 10000 }]
    const result = await calculateRedemptions(balances)

    expect(result.total_cash_value_cents).toBe(10000)
    expect(result.total_optimal_value_cents).toBe(10000)
    expect(result.value_left_on_table_cents).toBe(0)
    expect(result.cash_baseline_available).toBe(true)
    expect(result.results[0].category).toBe('cashback')
    expect(result.results[0].is_best).toBe(true)
  })

  it('finds higher-value multi-hop transfer paths', async () => {
    mockData.latest_valuations = [
      { program_id: 'chase-ur', cpp_cents: 2.0, program_name: 'Chase Ultimate Rewards', program_slug: 'chase-ur', program_type: 'transferable_points' },
      { program_id: 'hyatt', cpp_cents: 1.8, program_name: 'World of Hyatt', program_slug: 'hyatt', program_type: 'hotel_points' },
      { program_id: 'cash-only', cpp_cents: 1.0, program_name: 'Cash Only', program_slug: 'cash-only', program_type: 'cashback' },
      { program_id: 'united', cpp_cents: 1.2, program_name: 'United MileagePlus', program_slug: 'united', program_type: 'airline_miles' },
      { program_id: 'ana', cpp_cents: 2.6, program_name: 'ANA Mileage Club', program_slug: 'ana', program_type: 'airline_miles' },
    ]
    mockData.transfer_partners = [
      { id: TP_CHASE_UNITED, from_program_id: 'chase-ur', to_program_id: 'united', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
      { id: TP_CHASE_HYATT, from_program_id: 'chase-ur', to_program_id: 'hyatt', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
      { id: 'tp-chase-aeroplan', from_program_id: 'chase-ur', to_program_id: 'aeroplan', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
      { id: 'tp-aeroplan-ana', from_program_id: 'aeroplan', to_program_id: 'ana', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 24, is_instant: false },
    ]
    mockData.programs = [
      { id: 'chase-ur', name: 'Chase Ultimate Rewards', short_name: 'Chase UR', slug: 'chase-ur', color_hex: '#1c4d8c', type: 'transferable_points' },
      { id: 'hyatt', name: 'World of Hyatt', short_name: 'Hyatt', slug: 'hyatt', color_hex: '#b49970', type: 'hotel_points' },
      { id: 'cash-only', name: 'Cash Only', short_name: 'Cash', slug: 'cash-only', color_hex: '#22aa44', type: 'cashback' },
      { id: 'united', name: 'United MileagePlus', short_name: 'United', slug: 'united', color_hex: '#002244', type: 'airline_miles' },
      { id: 'aeroplan', name: 'Air Canada Aeroplan', short_name: 'Aeroplan', slug: 'aeroplan', color_hex: '#ff0000', type: 'airline_miles' },
      { id: 'ana', name: 'ANA Mileage Club', short_name: 'ANA', slug: 'ana', color_hex: '#003399', type: 'airline_miles' },
    ]

    const balances: BalanceInput[] = [{ program_id: 'chase-ur', amount: 10000 }]
    const result = await calculateRedemptions(balances)
    const best = result.results[0]

    expect(best.label).toBe('Transfer to ANA Mileage Club via Air Canada Aeroplan')
    expect(best.is_instant).toBe(false)
    expect(best.transfer_time_max_hrs).toBe(24)
    expect(best.total_value_cents).toBe(26000)
    expect(best.is_best).toBe(true)
  })

  it('returns null cash baseline totals when a balance has no direct cash option', async () => {
    mockData.transfer_partners = []
    const balances: BalanceInput[] = [{ program_id: 'united', amount: 10000 }]
    const result = await calculateRedemptions(balances)

    expect(result.total_cash_value_cents).toBeNull()
    expect(result.value_left_on_table_cents).toBeNull()
    expect(result.cash_baseline_available).toBe(false)
    expect(result.total_optimal_value_cents).toBe(0)
  })
})
