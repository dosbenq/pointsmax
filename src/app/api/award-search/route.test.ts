import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as awardSearch from '@/lib/award-search'
import type { AwardProvider } from '@/lib/award-search'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'example-anon-key'

// Mock dependencies
vi.mock('@/lib/award-search', async (importOriginal) => {
  const actual = await importOriginal<typeof awardSearch>()
  return {
    ...actual,
    createAwardProvider: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => {
  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((onFulfilled: (value: unknown) => unknown) => {
      return Promise.resolve({ data: [] }).then(onFulfilled)
    }),
  }
  return {
    createServerDbClient: vi.fn().mockReturnValue(mockQuery),
  }
})

vi.mock('./helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./helpers')>()
  return {
    ...actual,
    generateNarrative: vi.fn().mockResolvedValue({ headline: 'Mock Narrative' }),
  }
})

const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/award-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBalance = {
  program_id: '11111111-1111-1111-1111-111111111111',
  amount: 25000,
}

const validBody = {
  origin: 'JFK',
  destination: 'LHR',
  cabin: 'business',
  passengers: 1,
  start_date: '2026-03-01',
  end_date: '2026-03-05',
  balances: [validBalance],
}

describe('POST /api/award-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Validation', () => {
    it('rejects invalid origin IATA code', async () => {
      const req = makeRequest({ ...validBody, origin: 'JF' })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('rejects end_date before start_date', async () => {
      const req = makeRequest({ ...validBody, start_date: '2026-03-05', end_date: '2026-03-01' })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })

  describe('Functional requirements', () => {
    it('verifies sort order with mixed points and cpp', async () => {
      const mockResults = [
        { program_slug: 'high-points', points_needed_from_wallet: 100000, cpp_cents: 200 },
        { program_slug: 'low-points', points_needed_from_wallet: 50000, cpp_cents: 100 },
        { program_slug: 'same-points-high-cpp', points_needed_from_wallet: 50000, cpp_cents: 300 },
      ]

      vi.mocked(awardSearch.createAwardProvider).mockReturnValue({
        name: 'seats_aero',
        search: vi.fn().mockResolvedValue(mockResults),
      } as unknown as AwardProvider)

      const req = makeRequest(validBody)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.results.map((r: { program_slug: string }) => r.program_slug)).toEqual([
        'same-points-high-cpp',
        'low-points',
        'high-points',
      ])
    })

    it('verifies fallback payload includes estimates-only marker', async () => {
      vi.mocked(awardSearch.createAwardProvider).mockImplementation(() => {
        throw new awardSearch.AwardProviderUnavailableError()
      })

      const req = makeRequest(validBody)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.estimates_only).toBe(true)
      expect(body.provider).toBe('stub')
      expect(body.error).toBe('real_availability_unavailable')
    })
  })
})
