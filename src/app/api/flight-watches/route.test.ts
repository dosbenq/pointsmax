import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getUserTier } from '@/lib/subscription'

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/subscription', () => ({
  getUserTier: vi.fn(),
  canUseFeature: vi.fn((tier: 'free' | 'premium', feature: string) => {
    if (feature === 'flight_watches') return tier === 'premium'
    return false
  }),
}))

vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

function makeSupabaseMock() {
  const usersSingle = vi.fn().mockResolvedValue({ data: { id: 'user-row-1' }, error: null })
  const listOrder = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'watch-1',
        origin: 'JFK',
        destination: 'LHR',
        cabin: 'business',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        max_points: 60000,
        is_active: true,
        last_checked_at: null,
        created_at: '2026-03-16T00:00:00.000Z',
      },
    ],
    error: null,
  })
  const insertSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'watch-2',
      origin: 'JFK',
      destination: 'CDG',
      cabin: 'business',
      start_date: '2026-04-01',
      end_date: '2026-04-05',
      max_points: 50000,
      is_active: true,
      last_checked_at: null,
      created_at: '2026-03-16T00:00:00.000Z',
    },
    error: null,
  })
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: insertSingle,
    })),
  }))

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: usersSingle,
            })),
          })),
        }
      }

      if (table === 'flight_watches') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: listOrder,
            })),
          })),
          insert,
        }
      }

      return {
        select: vi.fn(),
        insert: vi.fn(),
      }
    }),
    __insert: insert,
  }
}

const { GET, POST } = await import('./route')

describe('flight-watches route gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 on POST for free-tier users', async () => {
    const supabase = makeSupabaseMock()
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never)
    vi.mocked(getUserTier).mockResolvedValue('free')

    const req = new NextRequest('https://pointsmax.com/api/flight-watches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        origin: 'JFK',
        destination: 'LHR',
        cabin: 'business',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        max_points: 50000,
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe('PREMIUM_REQUIRED')
    expect(supabase.__insert).not.toHaveBeenCalled()
  })

  it('keeps GET available for authenticated users regardless of tier', async () => {
    const supabase = makeSupabaseMock()
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never)

    const req = new NextRequest('https://pointsmax.com/api/flight-watches', {
      method: 'GET',
    })

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.watches).toHaveLength(1)
    expect(getUserTier).not.toHaveBeenCalled()
  })
})
