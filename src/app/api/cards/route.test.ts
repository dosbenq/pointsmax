import { beforeEach, describe, expect, it, vi } from 'vitest'

const createPublicClientMock = vi.fn()
const logErrorMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createPublicClient: createPublicClientMock,
}))

vi.mock('@/lib/logger', () => ({
  logError: logErrorMock,
}))

const { GET } = await import('./route')

type QueryResult<T> = { data: T; error: { message: string } | null }

function makeDbClient(options: {
  cards: QueryResult<Array<Record<string, unknown>>>
  valuations: QueryResult<Array<Record<string, unknown>>>
  rates: QueryResult<Array<Record<string, unknown>>>
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'cards') {
        const cardsQuery = {
          eq: vi.fn(() => cardsQuery),
          order: vi.fn(async () => options.cards),
        }
        return {
          select: vi.fn(() => cardsQuery),
        }
      }

      if (table === 'latest_valuations') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => options.valuations),
          })),
        }
      }

      if (table === 'card_earning_rates') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => options.rates),
          })),
        }
      }

      throw new Error(`Unexpected table queried: ${table}`)
    }),
  }
}

describe('GET /api/cards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 500 when base card or valuation queries fail', async () => {
    createPublicClientMock.mockReturnValue(
      makeDbClient({
        cards: { data: [], error: { message: 'cards failed' } },
        valuations: { data: [], error: null },
        rates: { data: [], error: null },
      })
    )

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=US'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(logErrorMock).toHaveBeenCalledWith(
      'cards_repository_fetch_failed',
      expect.objectContaining({ cards_error: 'cards failed' })
    )
  })

  it('returns 500 when earning-rates query fails', async () => {
    createPublicClientMock.mockReturnValue(
      makeDbClient({
        cards: {
          data: [
            {
              id: 'card-1',
              name: 'Card One',
              issuer: 'Issuer',
              annual_fee_usd: 95,
              signup_bonus_pts: 50000,
              signup_bonus_spend: 3000,
              program_id: 'program-1',
              apply_url: 'https://example.com/apply/card-1',
              is_active: true,
              display_order: 1,
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          error: null,
        },
        valuations: {
          data: [
            {
              program_id: 'program-1',
              cpp_cents: 2,
              program_name: 'Program One',
              program_slug: 'program-one',
              program_type: 'transferable_points',
            },
          ],
          error: null,
        },
        rates: { data: [], error: { message: 'rates failed' } },
      })
    )

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=US'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(logErrorMock).toHaveBeenCalledWith(
      'cards_repository_fetch_failed',
      expect.objectContaining({ rates_error: 'rates failed' })
    )
  })

  it('returns normalized cards payload with cache headers', async () => {
    createPublicClientMock.mockReturnValue(
      makeDbClient({
        cards: {
          data: [
            {
              id: 'card-1',
              name: 'Card One',
              issuer: 'Issuer',
              annual_fee_usd: 95,
              signup_bonus_pts: 50000,
              signup_bonus_spend: 3000,
              program_id: 'program-1',
              is_active: true,
              display_order: 1,
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          error: null,
        },
        valuations: {
          data: [
            {
              program_id: 'program-1',
              cpp_cents: 2,
              program_name: 'Program One',
              program_slug: 'program-one',
              program_type: 'transferable_points',
            },
          ],
          error: null,
        },
        rates: {
          data: [{ card_id: 'card-1', category: 'dining', earn_multiplier: 3 }],
          error: null,
        },
      })
    )

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=US'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300')
    expect(body.cards).toHaveLength(1)
    expect(body.cards[0]).toEqual(
      expect.objectContaining({
        id: 'card-1',
        geography: 'US',
        currency: 'USD',
        earn_unit: '1_dollar',
        apply_url: null,
        program_name: 'Program One',
        program_slug: 'program-one',
      })
    )
    expect(body.cards[0].earning_rates).toEqual(
      expect.objectContaining({
        dining: 3,
        groceries: 1,
        travel: 1,
      })
    )
  })

  it('returns india valuation units exactly as stored in the database', async () => {
    createPublicClientMock.mockReturnValue(
      makeDbClient({
        cards: {
          data: [
            {
              id: 'card-in-1',
              name: 'India Card',
              issuer: 'Issuer',
              annual_fee_usd: 5000,
              signup_bonus_pts: 0,
              signup_bonus_spend: 0,
              program_id: 'program-in-1',
              currency: 'INR',
              earn_unit: '100_inr',
              geography: 'IN',
              is_active: true,
              display_order: 1,
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          error: null,
        },
        valuations: {
          data: [
            {
              program_id: 'program-in-1',
              cpp_cents: 120,
              program_name: 'India Program',
              program_slug: 'india-program',
              program_type: 'transferable_points',
            },
          ],
          error: null,
        },
        rates: {
          data: [{ card_id: 'card-in-1', category: 'dining', earn_multiplier: 3.33 }],
          error: null,
        },
      })
    )

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=IN'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.geography).toBe('IN')
    expect(body.cards[0]).toEqual(
      expect.objectContaining({
        geography: 'IN',
        currency: 'INR',
        earn_unit: '100_inr',
        cpp_cents: 120,
      })
    )
  })

  it('keeps normalized india valuation units unchanged', async () => {
    createPublicClientMock.mockReturnValue(
      makeDbClient({
        cards: {
          data: [
            {
              id: 'card-in-2',
              name: 'India Card 2',
              issuer: 'Issuer',
              annual_fee_usd: 2500,
              signup_bonus_pts: 0,
              signup_bonus_spend: 0,
              program_id: 'program-in-2',
              currency: 'INR',
              earn_unit: '100_inr',
              geography: 'IN',
              is_active: true,
              display_order: 1,
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          error: null,
        },
        valuations: {
          data: [
            {
              program_id: 'program-in-2',
              cpp_cents: '120',
              program_name: 'India Program 2',
              program_slug: 'india-program-2',
              program_type: 'transferable_points',
            },
          ],
          error: null,
        },
        rates: {
          data: [{ card_id: 'card-in-2', category: 'dining', earn_multiplier: 2.67 }],
          error: null,
        },
      })
    )

    const res = await GET(new Request('https://pointsmax.com/api/cards?geography=IN'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.cards[0]).toEqual(
      expect.objectContaining({
        cpp_cents: 120,
      })
    )
  })
})
