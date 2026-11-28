import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BalanceInput } from '@/types/database'

type QueryError = { message: string; code?: string } | null
type QueryResult = { data: unknown[] | null; error: QueryError }

const mockData: Record<string, unknown[]> = {
  latest_valuations: [
    { program_id: 'chase-ur', cpp_cents: 2.0, program_name: 'Chase Ultimate Rewards', program_slug: 'chase-ur', program_type: 'transferable_points' },
    { program_id: 'hyatt', cpp_cents: 1.8, program_name: 'World of Hyatt', program_slug: 'hyatt', program_type: 'hotel_points' },
    { program_id: 'cash-only', cpp_cents: 1.0, program_name: 'Cash Only', program_slug: 'cash-only', program_type: 'cashback' },
    { program_id: 'united', cpp_cents: 1.2, program_name: 'United MileagePlus', program_slug: 'united', program_type: 'airline_miles' },
  ],
  transfer_partners: [
    { id: 'tp-chase-hyatt', from_program_id: 'chase-ur', to_program_id: 'hyatt', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
    { id: 'tp-chase-united', from_program_id: 'chase-ur', to_program_id: 'united', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
  ],
  active_bonuses: [],
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

let bonusError: QueryError = null

// Reference data comes from the catalog; feed the engine small synthetic fixtures.
vi.mock('@/lib/catalog', () => ({
  getCatalogLatestValuations: () => mockData.latest_valuations,
  getCatalogTransferPartners: () => mockData.transfer_partners,
  getCatalogRedemptionOptions: () => mockData.redemption_options,
  getCatalogPrograms: () => mockData.programs,
}))

// Only time-bound transfer bonuses still come from the database.
function makeBonusQuery() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      const result: QueryResult = bonusError ? { data: null, error: bonusError } : { data: mockData.active_bonuses, error: null }
      return Promise.resolve(result).then(onfulfilled ?? undefined, onrejected ?? undefined)
    },
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({
  createServerDbClient: vi.fn(() => ({
    from: vi.fn((tableName: string) => {
      if (tableName !== 'transfer_bonuses') throw new Error(`unexpected table ${tableName}`)
      return makeBonusQuery()
    }),
  })),
}))

vi.mock('@/lib/logger', () => ({ logWarn: vi.fn(), logError: vi.fn(), logInfo: vi.fn() }))

const { calculateRedemptions } = await import('./calculate')

afterEach(() => {
  bonusError = null
  mockData.active_bonuses = []
  mockData.latest_valuations = [
    { program_id: 'chase-ur', cpp_cents: 2.0, program_name: 'Chase Ultimate Rewards', program_slug: 'chase-ur', program_type: 'transferable_points' },
    { program_id: 'hyatt', cpp_cents: 1.8, program_name: 'World of Hyatt', program_slug: 'hyatt', program_type: 'hotel_points' },
    { program_id: 'cash-only', cpp_cents: 1.0, program_name: 'Cash Only', program_slug: 'cash-only', program_type: 'cashback' },
    { program_id: 'united', cpp_cents: 1.2, program_name: 'United MileagePlus', program_slug: 'united', program_type: 'airline_miles' },
  ]
  mockData.transfer_partners = [
    { id: 'tp-chase-hyatt', from_program_id: 'chase-ur', to_program_id: 'hyatt', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
    { id: 'tp-chase-united', from_program_id: 'chase-ur', to_program_id: 'united', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
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
    mockData.active_bonuses = [{ transfer_partner_id: 'tp-chase-hyatt', bonus_pct: 30 }]
    const result = await calculateRedemptions([{ program_id: 'chase-ur', amount: 10000 }])

    expect(result.results[0].label).toBe('Transfer to World of Hyatt')
    expect(result.total_optimal_value_cents).toBe(23400)
  })

  it('still calculates (without bonuses) when the database is unreachable', async () => {
    bonusError = { message: 'database paused' }
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
      { id: 'tp-chase-united', from_program_id: 'chase-ur', to_program_id: 'united', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
      { id: 'tp-chase-hyatt', from_program_id: 'chase-ur', to_program_id: 'hyatt', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
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
