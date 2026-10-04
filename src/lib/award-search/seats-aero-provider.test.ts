import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SeatsAeroProvider, seatsAeroSourceToSlug } from './seats-aero-provider'
import { AwardProviderUnavailableError } from './errors'
import * as cashFareProvider from './cash-fare-provider'

vi.mock('./cash-fare-provider', () => ({
  fetchCashFareUsd: vi.fn().mockResolvedValue(null),
}))

function makeClient(data: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const builder = {
        select() {
          return builder
        },
        in() {
          return builder
        },
        eq() {
          return builder
        },
        then(onfulfilled?: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve({ data: data[table] ?? [], error: null }).then(onfulfilled)
        },
      }
      return builder
    },
  }
}

describe('SeatsAeroProvider', () => {
  beforeEach(() => {
    vi.mocked(cashFareProvider.fetchCashFareUsd).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes chart-estimate rows when availability is empty and no path exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }))

    const provider = new SeatsAeroProvider('test-key')
    const client = makeClient({
      transfer_partners: [],
      programs: [
        { id: 'cash', name: 'Cash Wallet', short_name: 'Cash', slug: 'cash-wallet', color_hex: '#111111', type: 'cashback' },
        { id: 'united', name: 'United MileagePlus', short_name: 'United', slug: 'united', color_hex: '#002244', type: 'airline_miles' },
      ],
      latest_valuations: [
        { program_id: 'united', cpp_cents: 1.2, program_name: 'United MileagePlus', program_slug: 'united', program_type: 'airline_miles' },
      ],
    })

    const results = await provider.search({
      origin: 'JFK',
      destination: 'LHR',
      cabin: 'business',
      passengers: 1,
      start_date: '2026-04-01',
      end_date: '2026-04-02',
      balances: [{ program_id: 'cash', amount: 50000 }],
    }, client as never)

    expect(results).toHaveLength(1)
    expect(results[0].program_slug).toBe('united')
    expect(results[0].has_real_availability).toBe(false)
    expect(results[0].is_reachable).toBe(false)
    expect(results[0].points_needed_from_wallet).toBe(results[0].estimated_miles)
    expect(results[0].cash_value_source).toBe('modeled_route_fare')
    expect(results[0].cash_value_confidence).toBe('low')
    expect(results[0].baseline_cpp_cents).toBe(1.2)
    expect(results[0].estimated_cash_value_cents).toBeGreaterThan(0)
    expect(results[0].cpp_cents).toBeGreaterThan(results[0].baseline_cpp_cents)
  })

  it('prefers live fare pricing when available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }))
    vi.mocked(cashFareProvider.fetchCashFareUsd).mockResolvedValue(3900)

    const provider = new SeatsAeroProvider('test-key')
    const client = makeClient({
      transfer_partners: [],
      programs: [
        { id: 'cash', name: 'Cash Wallet', short_name: 'Cash', slug: 'cash-wallet', color_hex: '#111111', type: 'cashback' },
        { id: 'united', name: 'United MileagePlus', short_name: 'United', slug: 'united', color_hex: '#002244', type: 'airline_miles' },
      ],
      latest_valuations: [
        { program_id: 'united', cpp_cents: 1.2, program_name: 'United MileagePlus', program_slug: 'united', program_type: 'airline_miles' },
      ],
    })

    const results = await provider.search({
      origin: 'JFK',
      destination: 'LHR',
      cabin: 'business',
      passengers: 1,
      start_date: '2026-04-01',
      end_date: '2026-04-02',
      balances: [{ program_id: 'cash', amount: 50000 }],
    }, client as never)

    expect(results[0].cash_value_source).toBe('live_fare_api')
    expect(results[0].cash_value_confidence).toBe('high')
    expect(results[0].estimated_cash_value_cents).toBe(390000)
  })

  describe('live availability parsing', () => {
    const unitedOnly = {
      transfer_partners: [],
      programs: [
        { id: 'united', name: 'United MileagePlus', short_name: 'United', slug: 'united', color_hex: '#002244', type: 'airline_miles' },
      ],
      latest_valuations: [],
    }
    const params = {
      origin: 'JFK',
      destination: 'LHR',
      cabin: 'business' as const,
      passengers: 2,
      start_date: '2026-11-01',
      end_date: '2026-11-02',
      balances: [],
    }
    function flight(source: string, jCost: string) {
      return {
        ID: '1', RouteID: 'r', Route: { OriginAirport: 'JFK', DestinationAirport: 'LHR' },
        Date: '2026-11-01', ParsedDate: '2026-11-01T00:00:00Z',
        YAvailable: false, WAvailable: false, JAvailable: true, FAvailable: false,
        YMileageCost: '0', WMileageCost: '0', JMileageCost: jCost, FMileageCost: '0',
        YRemainingSeats: 0, WRemainingSeats: 0, JRemainingSeats: 2, FRemainingSeats: 0,
        Source: source, ComputedLastSeen: '', AvailabilityTrips: [],
      }
    }

    it('maps the lowercase source ids the API actually returns', () => {
      expect(seatsAeroSourceToSlug('united')).toBe('united')
      expect(seatsAeroSourceToSlug('flyingblue')).toBe('flying-blue')
      expect(seatsAeroSourceToSlug('virginatlantic')).toBe('virgin-atlantic')
      expect(seatsAeroSourceToSlug('FlyingBlue')).toBe('flying-blue')
      expect(seatsAeroSourceToSlug('qantas')).toBeNull()
      expect(seatsAeroSourceToSlug(undefined)).toBeNull()
    })

    it('uses real mileage from a { data } response with lowercase sources', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [flight('united', '80000'), flight('united', '60000')], count: 2 }),
      }))

      const results = await new SeatsAeroProvider('k').search(params, makeClient(unitedOnly) as never)
      const united = results.find((r) => r.program_slug === 'united')
      expect(united?.has_real_availability).toBe(true)
      expect(united?.estimated_miles).toBe(120000)
      expect(united?.availability?.source).toBe('seats_aero')
    })

    it.each([401, 403, 429, 500])('raises AwardProviderUnavailableError on HTTP %i instead of returning estimates silently', async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) }))

      await expect(
        new SeatsAeroProvider('bad').search(params, makeClient(unitedOnly) as never),
      ).rejects.toBeInstanceOf(AwardProviderUnavailableError)
    })

    it('raises AwardProviderUnavailableError when the network call fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))

      await expect(
        new SeatsAeroProvider('k').search(params, makeClient(unitedOnly) as never),
      ).rejects.toBeInstanceOf(AwardProviderUnavailableError)
    })

    it('treats a 404 as no availability, not an outage', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }))

      const results = await new SeatsAeroProvider('k').search(params, makeClient(unitedOnly) as never)
      expect(results.every((r) => !r.has_real_availability)).toBe(true)
    })
  })
})
