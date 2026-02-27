import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import {
  enforceJsonContentLength,
  enforceRateLimit,
  getClientIp,
} from './api-security'

describe('api-security', () => {
  describe('enforceJsonContentLength', () => {
    it('returns undefined when content-length is within limit', () => {
      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: { 'content-length': '100' },
      })
      
      const result = enforceJsonContentLength(req, 1000)
      expect(result).toBeUndefined()
    })

    it('returns undefined when content-length header is missing', () => {
      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
      })
      
      const result = enforceJsonContentLength(req, 1000)
      expect(result).toBeUndefined()
    })

    it('returns error response when content exceeds limit', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: { 'content-length': '2000' },
      })
      
      const result = enforceJsonContentLength(req, 1000)
      expect(result).toBeDefined()
      expect(result?.status).toBe(413)
      
      const body = await result?.json()
      expect(body.error.message).toContain('1000')
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE')
    })

    it('returns undefined for invalid content-length', () => {
      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: { 'content-length': 'not-a-number' },
      })
      
      const result = enforceJsonContentLength(req, 1000)
      expect(result).toBeUndefined()
    })
  })

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      })
      
      const ip = getClientIp(req)
      expect(ip).toBe('192.168.1.1')
    })

    it('extracts IP from x-real-ip header when x-forwarded-for is missing', () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-real-ip': '192.168.1.2' },
      })
      
      const ip = getClientIp(req)
      expect(ip).toBe('192.168.1.2')
    })

    it('returns unknown when no IP headers present', () => {
      const req = new NextRequest('https://example.com/api/test')
      
      const ip = getClientIp(req)
      expect(ip).toBe('unknown')
    })

    it('handles single IP in x-forwarded-for', () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.3' },
      })
      
      const ip = getClientIp(req)
      expect(ip).toBe('192.168.1.3')
    })

    it('trims whitespace from IP addresses', () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '  192.168.1.4  ' },
      })
      
      const ip = getClientIp(req)
      expect(ip).toBe('192.168.1.4')
    })
  })

  describe('enforceRateLimit', () => {
    it('allows requests within limit', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
      
      const result = await enforceRateLimit(req, {
        namespace: 'test',
        maxRequests: 10,
        windowMs: 60000,
      })
      
      expect(result).toBeUndefined()
    })

    it('returns error when rate limit exceeded', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.2' },
      })
      
      // Exhaust the rate limit
      for (let i = 0; i < 5; i++) {
        await enforceRateLimit(req, {
          namespace: 'test-limit',
          maxRequests: 5,
          windowMs: 60000,
        })
      }
      
      // This request should be rate limited
      const result = await enforceRateLimit(req, {
        namespace: 'test-limit',
        maxRequests: 5,
        windowMs: 60000,
      })
      
      expect(result).toBeDefined()
      expect(result?.status).toBe(429)
      expect(result?.headers.get('Retry-After')).toBeTruthy()
      
      const body = await result!.json()
      expect(body.error.code).toBe('RATE_LIMITED')
    })

    it('uses custom key when provided', async () => {
      const req = new NextRequest('https://example.com/api/test')
      
      // Use custom key instead of IP
      const result = await enforceRateLimit(
        req,
        {
          namespace: 'test-key',
          maxRequests: 10,
          windowMs: 60000,
        },
        'custom-key'
      )
      
      expect(result).toBeUndefined()
    })

    it('returns error with correct Retry-After header', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.3' },
      })
      
      // Exhaust the rate limit
      for (let i = 0; i < 3; i++) {
        await enforceRateLimit(req, {
          namespace: 'test-retry',
          maxRequests: 3,
          windowMs: 60000,
        })
      }
      
      const result = await enforceRateLimit(req, {
        namespace: 'test-retry',
        maxRequests: 3,
        windowMs: 60000,
      })
      
      const retryAfter = result?.headers.get('Retry-After')
      expect(retryAfter).toBeTruthy()
      expect(Number(retryAfter)).toBeGreaterThan(0)
      expect(Number(retryAfter)).toBeLessThanOrEqual(60)
    })

    it('allows requests from different IPs independently', async () => {
      const req1 = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.10' },
      })
      const req2 = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.11' },
      })
      
      // Exhaust limit for first IP
      for (let i = 0; i < 5; i++) {
        await enforceRateLimit(req1, {
          namespace: 'test-multi-ip',
          maxRequests: 5,
          windowMs: 60000,
        })
      }
      
      // First IP should be rate limited
      const result1 = await enforceRateLimit(req1, {
        namespace: 'test-multi-ip',
        maxRequests: 5,
        windowMs: 60000,
      })
      expect(result1).toBeDefined()
      
      // Second IP should still be allowed
      const result2 = await enforceRateLimit(req2, {
        namespace: 'test-multi-ip',
        maxRequests: 5,
        windowMs: 60000,
      })
      expect(result2).toBeUndefined()
    })
  })
})
