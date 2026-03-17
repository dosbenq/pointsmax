import { describe, expect, it, vi } from 'vitest'
import { ChartHotelProvider } from './chart-provider'

describe('ChartHotelProvider', () => {
  it('returns ranked hotel results with transfer details', async () => {
    const client = { from: vi.fn() }
    ;(client.from as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [
              {
                id: 'hotel-hyatt',
                slug: 'hyatt',
                name: 'World of Hyatt',
                chain: 'Hyatt',
                booking_url: 'https://world.hyatt.com/content/gp/en/rewards.html',
                color_hex: '#B49970',
              },
            ],
            error: null,
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [
              {
                program_id: 'hotel-hyatt',
                destination_region: 'asia_pacific',
                tier_label: 'Category 4',
                tier_number: 4,
                points_off_peak: 12000,
                points_standard: 15000,
                points_peak: 18000,
                estimated_cash_usd: 320,
              },
            ],
            error: null,
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [
              {
                id: 'chase-id',
                name: 'Chase Ultimate Rewards',
                short_name: 'Chase UR',
                slug: 'chase-ur',
                color_hex: '#1177ff',
                type: 'transferable_points',
              },
              {
                id: 'hyatt-id',
                name: 'World of Hyatt',
                short_name: 'Hyatt',
                slug: 'hyatt',
                color_hex: '#B49970',
                type: 'hotel_points',
              },
            ],
            error: null,
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [
              {
                id: 'tp-1',
                from_program_id: 'chase-id',
                to_program_id: 'hyatt-id',
                ratio_from: 1,
                ratio_to: 1,
                is_instant: true,
                transfer_time_max_hrs: 0,
              },
            ],
            error: null,
          })),
        })),
      }))

    const provider = new ChartHotelProvider()
    const results = await provider.search({
      destination_region: 'asia_pacific',
      check_in: '2026-04-01',
      check_out: '2026-04-04',
      balances: [{ program_id: 'chase-id', amount: 50000 }],
    }, client as never)

    expect(results).toHaveLength(1)
    expect(results[0].program_slug).toBe('hyatt')
    expect(results[0].nights).toBe(3)
    expect(results[0].points_standard_total).toBe(45000)
    expect(results[0].is_reachable).toBe(true)
    expect(results[0].transfer_chain).toContain('Chase Ultimate Rewards')
    expect(results[0].cpp_cents).toBeGreaterThan(2)
  })
})
