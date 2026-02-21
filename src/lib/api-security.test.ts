import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit, getClientIp } from '@/lib/api-security'

function makeRequest(init?: { headers?: Record<string, string> }) {
  return new NextRequest('https://pointsmax.com/api/test', {
    method: 'POST',
    headers: init?.headers,
  })
}

describe('api-security helpers', () => {
  it('extracts client IP from forwarding headers', () => {
    const req = makeRequest({ headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' } })
    expect(getClientIp(req)).toBe('203.0.113.10')
  })

  it('rejects oversized JSON payloads by content-length', () => {
    const req = makeRequest({ headers: { 'content-length': '9999' } })
    const response = enforceJsonContentLength(req, 1024)
    expect(response?.status).toBe(413)
  })

  it('rate limits after maxRequests within window', async () => {
    const req = makeRequest({ headers: { 'x-forwarded-for': '198.51.100.15' } })
    const config = {
      namespace: `vitest_rate_limit_${Date.now()}`,
      maxRequests: 1,
      windowMs: 60_000,
    }

    const first = await enforceRateLimit(req, config)
    const second = await enforceRateLimit(req, config)

    expect(first).toBeUndefined()
    expect(second?.status).toBe(429)
    expect(second?.headers.get('Retry-After')).toBeTruthy()
  })
})
