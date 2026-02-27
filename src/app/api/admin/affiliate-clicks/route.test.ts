import { beforeEach, describe, expect, it, vi } from 'vitest'

const createAdminClientMock = vi.fn()
const requireAdminMock = vi.fn()
const logErrorMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/logger', () => ({
  logError: logErrorMock,
}))

const { GET } = await import('./route')

describe('GET /api/admin/affiliate-clicks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(null)
  })

  it('returns grouped metrics for the last 30 days', async () => {
    const mockData = [
      {
        card_id: 'card-1',
        source_page: 'recommender',
        creator_slug: null,
        region: 'us',
        rank: 1,
        created_at: new Date().toISOString(),
        cards: { name: 'Card One' },
      },
      {
        card_id: 'card-1',
        source_page: 'recommender',
        creator_slug: null,
        region: 'us',
        rank: 2,
        created_at: new Date().toISOString(),
        cards: { name: 'Card One' },
      },
      {
        card_id: 'card-2',
        source_page: 'card-page',
        creator_slug: 'creator-1',
        region: 'in',
        rank: null,
        created_at: new Date().toISOString(),
        cards: { name: 'Card Two' },
      },
    ]

    const dbClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    }
    createAdminClientMock.mockReturnValue(dbClient)

    const res = await GET(new Request('http://localhost/api/admin/affiliate-clicks'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.window_days).toBe(30)
    expect(body.rows).toHaveLength(2) // card-1:recommender:none:us and card-2:card-page:creator-1:in
    
    const row1 = body.rows.find((r: { card_id: string; clicks: number; region: string | null }) => r.card_id === 'card-1')
    expect(row1.clicks).toBe(2)
    expect(row1.region).toBe('us')

    const row2 = body.rows.find((r: { card_id: string; clicks: number; region: string | null; creator_slug: string | null }) => r.card_id === 'card-2')
    expect(row2.clicks).toBe(1)
    expect(row2.region).toBe('in')
    expect(row2.creator_slug).toBe('creator-1')
  })
})
