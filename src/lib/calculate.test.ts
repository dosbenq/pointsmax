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

let mockErrors: Record<string, QueryError> = {}
let simulateProgramsGeographyMissing = false

function makeQuery(tableName: string) {
  let selectClause = ''
  const builder = {
    select: vi.fn((clause: string) => {
      selectClause = clause
      return builder
    }),
    in: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      let result: QueryResult = { data: mockData[tableName] ?? [], error: mockErrors[tableName] ?? null }

      if (
        tableName === 'programs' &&
        simulateProgramsGeographyMissing &&
        selectClause.includes('geography')
      ) {
        result = { data: null, error: { message: 'column programs.geography does not exist', code: '42703' } }
      }

      return Promise.resolve(result).then(
        onfulfilled ?? undefined,
        onrejected ?? undefined,
      )
    },
  }

  return builder
}

vi.mock('@/lib/supabase', () => ({
  createServerDbClient: vi.fn(() => ({
    from: vi.fn((tableName: string) => makeQuery(tableName)),
  })),
}))

const { calculateRedemptions } = await import('./calculate')

afterEach(() => {
  mockErrors = {}
  simulateProgramsGeographyMissing = false
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

  it('falls back to legacy programs select when geography column is missing', async () => {
    simulateProgramsGeographyMissing = true
    const balances: BalanceInput[] = [{ program_id: 'chase-ur', amount: 10000 }]
    const result = await calculateRedemptions(balances)

    expect(result.total_optimal_value_cents).toBe(18000)
    expect(result.results[0].label).toBe('Transfer to World of Hyatt')
  })

  it('throws when a required query fails', async () => {
    mockErrors.latest_valuations = { message: 'boom' }
    const balances: BalanceInput[] = [{ program_id: 'chase-ur', amount: 10000 }]

    await expect(calculateRedemptions(balances)).rejects.toThrow('Failed to load valuations')
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

  it('converts a cents-valued global target into paise for an Indian currency', async () => {
    mockData.latest_valuations = [
      { program_id: 'amex-india-mr', cpp_cents: 75, effective_date: '2026-03-06', program_name: 'Amex MR India', program_slug: 'amex-india-mr', program_type: 'transferable_points' },
      { program_id: 'marriott', cpp_cents: 0.75, effective_date: '2026-04-09', program_name: 'Marriott Bonvoy', program_slug: 'marriott', program_type: 'hotel_points' },
    ]
    mockData.transfer_partners = [
      { id: 'tp-amexin-marriott', from_program_id: 'amex-india-mr', to_program_id: 'marriott', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 72, is_instant: false },
    ]
    mockData.programs = [
      { id: 'amex-india-mr', name: 'Amex MR India', short_name: 'Amex IN', slug: 'amex-india-mr', color_hex: '#000', type: 'transferable_points', geography: 'IN' },
      { id: 'marriott', name: 'Marriott Bonvoy', short_name: 'Marriott', slug: 'marriott', color_hex: '#000', type: 'hotel_points', geography: 'global' },
    ]

    const result = await calculateRedemptions([{ program_id: 'amex-india-mr', amount: 10000 }])
    const marriott = result.results.find((r) => r.to_program?.slug === 'marriott')

    // 0.75 US cents = 0.75 * 88 = 66 paise per point
    expect(marriott?.cpp_cents).toBeCloseTo(66, 5)
    expect(marriott?.total_value_cents).toBeCloseTo(660000, 5)
  })

  it('labels results with the review dates of the valuations used', async () => {
    mockData.latest_valuations = mockData.latest_valuations.map((v, i) => ({
      ...(v as object),
      effective_date: i === 0 ? '2025-01-15' : '2026-04-09',
    }))
    const result = await calculateRedemptions([{ program_id: 'chase-ur', amount: 10000 }])
    expect(result.valuation_source).toBe('Valuations reviewed Jan 2025 – Apr 2026')
  })
})

