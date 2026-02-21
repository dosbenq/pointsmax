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
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => options.cards),
            })),
          })),
        }
      }

      if (table === 'latest_valuations') {
        return {
          select: vi.fn(async () => options.valuations),
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

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Internal error')
    expect(logErrorMock).toHaveBeenCalledWith(
      'cards_api_fetch_failed',
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

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Internal error')
    expect(logErrorMock).toHaveBeenCalledWith(
      'cards_api_rates_fetch_failed',
      expect.objectContaining({ error: 'rates failed' })
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

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300')
    expect(body.cards).toHaveLength(1)
    expect(body.cards[0]).toEqual(
      expect.objectContaining({
        id: 'card-1',
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
})
