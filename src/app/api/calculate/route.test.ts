import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/calculate', () => ({
  calculateRedemptions: vi.fn(),
}))

vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  getRequestId: vi.fn(() => 'test-request-id'),
}))

const { calculateRedemptions } = await import('@/lib/calculate')
const { POST } = await import('./route')

function makeRequest(body: unknown, opts?: { headers?: Record<string, string> }) {
  return new NextRequest('https://pointsmax.com/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    body: JSON.stringify(body),
  })
}

function makeRequestWithRawBody(body: string, opts?: { headers?: Record<string, string> }) {
  return new NextRequest('https://pointsmax.com/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    body,
  })
}

describe('POST /api/calculate', () => {
  // Clear result cache before each test to ensure deterministic behavior
  beforeEach(() => {
    vi.clearAllMocks()
    const globalRef = globalThis as typeof globalThis & {
      __pointsmaxAiResponseCache?: Map<string, unknown>
    }
    if (globalRef.__pointsmaxAiResponseCache) {
      globalRef.__pointsmaxAiResponseCache.clear()
    }
  })

  describe('Validation', () => {
    it('returns bad request for missing balances', async () => {
      const res = await POST(makeRequest({ balances: [] }))
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.message).toContain('at least one balance')
    })

    it('returns bad request for invalid balance entry (missing program_id)', async () => {
      const res = await POST(makeRequest({
        balances: [{ amount: 25000 }],
      }))
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
      expect(payload.error.message).toContain('program_id')
    })

    it('returns bad request for invalid balance entry (non-positive amount)', async () => {
      const res = await POST(makeRequest({
        balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: 0 }],
      }))
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
      expect(payload.error.message).toContain('positive amount')
    })

    it('returns bad request for invalid balance entry (negative amount)', async () => {
      const res = await POST(makeRequest({
        balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: -100 }],
      }))
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
    })

    it('returns bad request for invalid balance entry (non-numeric amount)', async () => {
      const res = await POST(makeRequest({
        balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: 'invalid' }],
      }))
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
    })

    it('returns bad request for invalid JSON body', async () => {
      const res = await POST(makeRequestWithRawBody('not valid json'))
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
      expect(payload.error.message).toContain('Invalid JSON')
    })

    it('returns bad request when balances is not an array', async () => {
      const res = await POST(makeRequest({ balances: 'not-an-array' }))
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.error.code).toBe('BAD_REQUEST')
    })
  })

  describe('Contract tests', () => {
    it('returns calculation results with correct contract structure', async () => {
      const mockResult = {
        results: [
          { id: 'result-1', program: 'Test Program', value_cents: 50000 },
        ],
        summary: { total_options: 1, best_value_cents: 50000 },
      }
      vi.mocked(calculateRedemptions).mockResolvedValueOnce(mockResult)

      const res = await POST(makeRequest({
        balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: 25000 }],
      }))

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('application/json')
      expect(res.headers.get('X-PointsMax-Cache')).toBe('MISS')
      expect(res.headers.get('X-Calculate-Latency-Ms')).toMatch(/^\d+$/)

      const payload = await res.json()
      expect(payload).toEqual(mockResult)
    })

    it('returns error contract for internal errors', async () => {
      vi.mocked(calculateRedemptions).mockRejectedValueOnce(new Error('Database connection failed'))

      const res = await POST(makeRequest({
        balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: 25000 }],
      }))

      expect(res.status).toBe(500)
      const payload = await res.json()
      expect(payload.error).toBeDefined()
      expect(payload.error.code).toBe('INTERNAL_ERROR')
      expect(typeof payload.error.message).toBe('string')
    })

    it('accepts balances with program_id in different order (normalization)', async () => {
      vi.mocked(calculateRedemptions).mockResolvedValueOnce({ results: [], summary: null })

      // Use unique program IDs not used in other tests to avoid cache conflicts
      const res = await POST(makeRequest({
        balances: [
          { program_id: '99999999-9999-9999-9999-999999999999', amount: 15000 },
          { program_id: '88888888-8888-8888-8888-888888888888', amount: 25000 },
        ],
      }))

      expect(res.status).toBe(200)
      // Verify balances are passed to calculateRedemptions (order preserved as passed)
      expect(calculateRedemptions).toHaveBeenCalledWith([
        { program_id: '99999999-9999-9999-9999-999999999999', amount: 15000 },
        { program_id: '88888888-8888-8888-8888-888888888888', amount: 25000 },
      ])
    })

    it('normalizes balance amounts by flooring decimals', async () => {
      vi.mocked(calculateRedemptions).mockResolvedValueOnce({ results: [], summary: null })

      await POST(makeRequest({
        balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: 25000.9 }],
      }))

      // Cache key should use floored amount
      const secondRequest = await POST(makeRequest({
        balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: 25000.1 }],
      }))

      // Should hit cache since both normalize to 25000
      expect(secondRequest.headers.get('X-PointsMax-Cache')).toBe('HIT')
    })
  })

  describe('Caching behavior', () => {
    it('caches identical requests in-memory', async () => {
      vi.mocked(calculateRedemptions).mockResolvedValue({ results: [{ id: 'x' }], summary: null })

      const body = {
        balances: [{ program_id: '22222222-2222-2222-2222-222222222222', amount: 10000 }],
      }

      const first = await POST(makeRequest(body))
      const second = await POST(makeRequest(body))

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(first.headers.get('X-PointsMax-Cache')).toBe('MISS')
      expect(second.headers.get('X-PointsMax-Cache')).toBe('HIT')
      expect(calculateRedemptions).toHaveBeenCalledTimes(1)
    })

    it('cache respects different balance amounts', async () => {
      vi.mocked(calculateRedemptions).mockResolvedValue({ results: [], summary: null })

      const first = await POST(makeRequest({
        balances: [{ program_id: '44444444-4444-4444-4444-444444444444', amount: 10000 }],
      }))
      const second = await POST(makeRequest({
        balances: [{ program_id: '44444444-4444-4444-4444-444444444444', amount: 20000 }],
      }))

      expect(first.headers.get('X-PointsMax-Cache')).toBe('MISS')
      expect(second.headers.get('X-PointsMax-Cache')).toBe('MISS')
      expect(calculateRedemptions).toHaveBeenCalledTimes(2)
    })
  })
})
