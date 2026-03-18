import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminClient } from '@/lib/supabase'
import { fetchCashFareUsd } from './cash-fare-provider'

vi.mock('@/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

describe('fetchCashFareUsd', () => {
  const originalKey = process.env.SERPAPI_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SERPAPI_KEY = 'serp_test'
  })

  afterEach(() => {
    process.env.SERPAPI_KEY = originalKey
    vi.unstubAllGlobals()
  })

  it('returns null when the API key is missing', async () => {
    delete process.env.SERPAPI_KEY
    await expect(fetchCashFareUsd('JFK', 'LHR', 'business', '2026-04-01')).resolves.toBeNull()
  })

  it('uses a fresh cache row when available', async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'cache',
                origin: 'JFK',
                destination: 'LHR',
                cabin: 'business',
                travel_date: '2026-04-01',
                fare_usd: 1234,
                fetched_at: new Date().toISOString(),
              },
            }),
          })),
        })),
      })),
    } as never)

    await expect(fetchCashFareUsd('JFK', 'LHR', 'business', '2026-04-01')).resolves.toBe(1234)
  })

  it('fetches and stores a fare from SerpAPI when cache is stale', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'cache',
                fare_usd: 999,
                fetched_at: '2020-01-01T00:00:00.000Z',
              },
            }),
          })),
        })),
        upsert,
      })),
    } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        best_flights: [{ price: '$1,876' }],
      }),
    }))

    await expect(fetchCashFareUsd('JFK', 'LHR', 'business', '2026-04-01')).resolves.toBe(1876)
    expect(upsert).toHaveBeenCalled()
  })
})
