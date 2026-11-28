import { describe, expect, it, vi } from 'vitest'
import { StubProvider } from './stub-provider'

const catalogFixture: { transfer_partners: unknown[]; programs: unknown[]; latest_valuations: unknown[] } = {
  transfer_partners: [],
  programs: [],
  latest_valuations: [],
}

vi.mock('@/lib/catalog', () => ({
  getCatalogTransferPartners: () => catalogFixture.transfer_partners,
  getCatalogPrograms: () => catalogFixture.programs,
  getCatalogLatestValuations: () => catalogFixture.latest_valuations,
}))

function setCatalog(data: Partial<typeof catalogFixture>) {
  Object.assign(catalogFixture, { transfer_partners: [], programs: [], latest_valuations: [] }, data)
}

describe('StubProvider', () => {
  it('includes chart-estimate results even when no reachable transfer path exists', async () => {
    const provider = new StubProvider()
    setCatalog({
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
    })

    expect(results).toHaveLength(1)
    expect(results[0].program_slug).toBe('united')
    expect(results[0].is_reachable).toBe(false)
    expect(results[0].points_needed_from_wallet).toBe(results[0].estimated_miles)
  })
})
