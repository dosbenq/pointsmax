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

// Mock rate limiting to avoid state pollution between tests
vi.mock('@/lib/api-security', async () => {
  return {
    enforceJsonContentLength: vi.fn(() => null),
    enforceRateLimit: vi.fn(async () => null),
    getClientIp: vi.fn(() => '127.0.0.1'),
  }
})

const { POST } = await import('./route')

function makeRequest(body: unknown, opts?: { headers?: Record<string, string> }) {
  return new NextRequest('https://pointsmax.com/api/award-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    body: JSON.stringify(body),
  })
}

function makeRequestWithRawBody(body: string, opts?: { headers?: Record<string, string> }) {
  return new NextRequest('https://pointsmax.com/api/award-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    body,
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
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
    })

    it('rejects end_date before start_date', async () => {
      const req = makeRequest({ ...validBody, start_date: '2026-03-05', end_date: '2026-03-01' })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
    })

    it('rejects invalid JSON body', async () => {
      const req = makeRequestWithRawBody('not valid json')
      const res = await POST(req)
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
      expect(payload.error.message).toContain('Invalid JSON')
    })

    it('rejects missing origin', async () => {
      const bodyWithoutOrigin = { ...validBody }
      delete (bodyWithoutOrigin as { origin?: string }).origin
      const req = makeRequest(bodyWithoutOrigin)
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('rejects missing destination', async () => {
      const bodyWithoutDestination = { ...validBody }
      delete (bodyWithoutDestination as { destination?: string }).destination
      const req = makeRequest(bodyWithoutDestination)
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
      expect(body.message).toBeDefined()
      expect(body.searched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('verifies successful response contract structure', async () => {
      const mockResults = [{ program_slug: 'test', points_needed_from_wallet: 50000, cpp_cents: 200 }]

      vi.mocked(awardSearch.createAwardProvider).mockReturnValue({
        name: 'seats_aero',
        search: vi.fn().mockResolvedValue(mockResults),
      } as unknown as AwardProvider)

      const req = makeRequest(validBody)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.provider).toBe('seats_aero')
      expect(body.params).toBeDefined()
      expect(body.params.origin).toBe('JFK')
      expect(body.params.destination).toBe('LHR')
      expect(Array.isArray(body.results)).toBe(true)
      expect(body.searched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('Fallback and edge cases', () => {
    it('returns empty results when provider returns no results', async () => {
      vi.mocked(awardSearch.createAwardProvider).mockReturnValue({
        name: 'seats_aero',
        search: vi.fn().mockResolvedValue([]),
      } as unknown as AwardProvider)

      const req = makeRequest(validBody)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.results).toEqual([])
      expect(body.provider).toBe('seats_aero')
    })

    it('returns internal error when fallback provider also fails', async () => {
      // First, make the StubProvider fail by mocking the DB to throw
      const { createServerDbClient } = await import('@/lib/supabase')
      vi.mocked(createServerDbClient).mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      vi.mocked(awardSearch.createAwardProvider).mockImplementation(() => {
        throw new awardSearch.AwardProviderUnavailableError()
      })

      const req = makeRequest(validBody)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_ERROR')
    })

    it('handles generic errors (non-AwardProviderUnavailableError)', async () => {
      vi.mocked(awardSearch.createAwardProvider).mockImplementation(() => {
        throw new Error('Generic provider error')
      })

      const req = makeRequest(validBody)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_ERROR')
      expect(body.error.message).toContain('Search failed')
    })

    it('handles different cabin classes', async () => {
      const mockResults = [{ program_slug: 'test', points_needed_from_wallet: 50000, cpp_cents: 200 }]

      vi.mocked(awardSearch.createAwardProvider).mockReturnValue({
        name: 'seats_aero',
        search: vi.fn().mockResolvedValue(mockResults),
      } as unknown as AwardProvider)

      const cabins = ['economy', 'premium_economy', 'business', 'first']
      
      for (const cabin of cabins) {
        vi.clearAllMocks()
        vi.mocked(awardSearch.createAwardProvider).mockReturnValue({
          name: 'seats_aero',
          search: vi.fn().mockResolvedValue(mockResults),
        } as unknown as AwardProvider)

        const req = makeRequest({ ...validBody, cabin })
        const res = await POST(req)
        expect(res.status).toBe(200)
      }
    })

    it('handles multiple passengers', async () => {
      const mockResults = [{ program_slug: 'test', points_needed_from_wallet: 150000, cpp_cents: 200 }]

      vi.mocked(awardSearch.createAwardProvider).mockReturnValue({
        name: 'seats_aero',
        search: vi.fn().mockResolvedValue(mockResults),
      } as unknown as AwardProvider)

      const req = makeRequest({ ...validBody, passengers: 3 })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.params.passengers).toBe(3)
    })

    it('handles large date ranges', async () => {
      const mockResults = [{ program_slug: 'test', points_needed_from_wallet: 50000, cpp_cents: 200 }]

      vi.mocked(awardSearch.createAwardProvider).mockReturnValue({
        name: 'seats_aero',
        search: vi.fn().mockResolvedValue(mockResults),
      } as unknown as AwardProvider)

      const req = makeRequest({
        ...validBody,
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })
})
