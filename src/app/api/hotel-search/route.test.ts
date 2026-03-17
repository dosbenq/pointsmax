import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createServerDbClient } from '@/lib/supabase'
import * as hotelSearch from '@/lib/hotel-search'

vi.mock('@/lib/supabase', () => ({
  createServerDbClient: vi.fn(),
}))

vi.mock('@/lib/hotel-search', async (importOriginal) => {
  const actual = await importOriginal<typeof hotelSearch>()
  return {
    ...actual,
    createHotelSearchProvider: vi.fn(),
  }
})

vi.mock('@/lib/api-security', async () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/hotel-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/hotel-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServerDbClient).mockReturnValue({} as never)
  })

  it('rejects invalid destination regions', async () => {
    const response = await POST(makeRequest({
      destination_region: 'tokyo',
      check_in: '2026-04-01',
      check_out: '2026-04-04',
      balances: [],
    }))

    expect(response.status).toBe(400)
  })

  it('rejects invalid date ranges', async () => {
    const response = await POST(makeRequest({
      destination_region: 'asia_pacific',
      check_in: '2026-04-04',
      check_out: '2026-04-01',
      balances: [],
    }))

    expect(response.status).toBe(400)
  })

  it('returns ranked hotel results from the provider', async () => {
    vi.mocked(hotelSearch.createHotelSearchProvider).mockReturnValue({
      search: vi.fn().mockResolvedValue([
        {
          program_slug: 'hyatt',
          program_name: 'World of Hyatt',
          chain: 'Hyatt',
          tier_label: 'Category 4',
          tier_number: 4,
          nights: 3,
          points_off_peak_total: 36000,
          points_standard_total: 45000,
          points_peak_total: 54000,
          estimated_cash_value_usd: 960,
          cpp_cents: 2.13,
          transfer_chain: 'Chase Ultimate Rewards → World of Hyatt',
          transfer_is_instant: true,
          transfer_time_max_hrs: 0,
          is_reachable: true,
          points_needed_from_wallet: 45000,
          booking_url: 'https://world.hyatt.com/content/gp/en/rewards.html',
        },
      ]),
    })

    const response = await POST(makeRequest({
      destination_region: 'asia_pacific',
      check_in: '2026-04-01',
      check_out: '2026-04-04',
      balances: [{ program_id: 'chase-ur-id', amount: 50000 }],
    }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.results).toHaveLength(1)
    expect(payload.results[0].program_slug).toBe('hyatt')
    expect(payload.params.destination_region).toBe('asia_pacific')
  })
})
