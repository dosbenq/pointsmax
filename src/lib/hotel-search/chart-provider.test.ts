import { describe, expect, it } from 'vitest'
import { getCatalogProgramBySlug } from '@/lib/catalog'
import { ChartHotelProvider } from './chart-provider'

describe('ChartHotelProvider', () => {
  it('returns hotel award-chart results with transfer details from the catalog', async () => {
    const chaseId = getCatalogProgramBySlug('chase-ur')!.id
    const provider = new ChartHotelProvider()

    const results = await provider.search({
      destination_region: 'asia_pacific',
      hotel_name: 'Hyatt',
      check_in: '2026-04-01',
      check_out: '2026-04-04',
      balances: [{ program_id: chaseId, amount: 50000 }],
    })

    expect(results.length).toBe(8) // Hyatt categories 1-8
    expect(results.every((result) => result.program_slug === 'hyatt')).toBe(true)

    const category4 = results.find((result) => result.tier_label === 'Category 4')!
    expect(category4.nights).toBe(3)
    expect(category4.points_standard_total).toBe(45000)
    expect(category4.is_reachable).toBe(true)
    expect(category4.transfer_chain).toContain('Chase Ultimate Rewards')
    expect(category4.cpp_cents).toBeGreaterThan(2)
  })

  it('covers every chain in a region when no hotel is named', async () => {
    const results = await new ChartHotelProvider().search({
      destination_region: 'europe',
      check_in: '2026-04-01',
      check_out: '2026-04-02',
      balances: [],
    })

    expect(new Set(results.map((result) => result.program_slug))).toEqual(new Set(['hyatt', 'marriott', 'hilton']))
    expect(results.every((result) => result.is_reachable === false)).toBe(true)
  })
})
