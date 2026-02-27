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
}))

const { calculateRedemptions } = await import('@/lib/calculate')
const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns bad request for missing balances', async () => {
    const res = await POST(makeRequest({ balances: [] }))
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error.message).toContain('at least one balance')
  })

  it('returns calculation results for valid balances', async () => {
    vi.mocked(calculateRedemptions).mockResolvedValueOnce({ results: [], summary: null })

    const res = await POST(makeRequest({
      balances: [{ program_id: '11111111-1111-1111-1111-111111111111', amount: 25000 }],
    }))

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload).toEqual({ results: [], summary: null })
    expect(res.headers.get('X-PointsMax-Cache')).toBe('MISS')
  })

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
})
