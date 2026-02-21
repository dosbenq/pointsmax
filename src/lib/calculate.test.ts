import { describe, expect, it, vi } from 'vitest'
import type { BalanceInput } from '@/types/database'

type QueryResult = { data: unknown[]; error: null }

const mockData: Record<string, unknown[]> = {
  latest_valuations: [
    { program_id: 'chase-ur', cpp_cents: 2.0, program_name: 'Chase Ultimate Rewards', program_slug: 'chase-ur', program_type: 'transferable_points' },
    { program_id: 'hyatt', cpp_cents: 1.8, program_name: 'World of Hyatt', program_slug: 'hyatt', program_type: 'hotel_points' },
  ],
  transfer_partners: [
    { id: 'tp-chase-hyatt', from_program_id: 'chase-ur', to_program_id: 'hyatt', ratio_from: 1, ratio_to: 1, transfer_time_max_hrs: 0, is_instant: true },
  ],
  active_bonuses: [],
  redemption_options: [
    { program_id: 'chase-ur', category: 'travel_portal', cpp_cents: 1.5, label: 'Chase Travel Portal' },
    { program_id: 'chase-ur', category: 'cashback', cpp_cents: 1.0, label: 'Cash Back' },
  ],
  programs: [
    { id: 'chase-ur', name: 'Chase Ultimate Rewards', short_name: 'Chase UR', slug: 'chase-ur', color_hex: '#1c4d8c', type: 'transferable_points' },
    { id: 'hyatt', name: 'World of Hyatt', short_name: 'Hyatt', slug: 'hyatt', color_hex: '#b49970', type: 'hotel_points' },
  ],
}

function makeQuery(tableName: string) {
  const builder = {
    select: vi.fn(() => builder),
    in: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve({ data: mockData[tableName] ?? [], error: null }).then(
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

describe('calculateRedemptions', () => {
  it('ranks best option and computes totals for a basic transferable balance', async () => {
    const balances: BalanceInput[] = [{ program_id: 'chase-ur', amount: 10000 }]
    const result = await calculateRedemptions(balances)

    expect(result.total_cash_value_cents).toBe(10000)
    expect(result.total_optimal_value_cents).toBe(18000)
    expect(result.value_left_on_table_cents).toBe(8000)

    expect(result.results.length).toBe(3)
    expect(result.results[0].label).toBe('Transfer to World of Hyatt')
    expect(result.results[0].is_best).toBe(true)
  })
})
