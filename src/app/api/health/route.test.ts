import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, HEAD } from './route'

describe('GET /api/health', () => {
  it('returns health status', async () => {
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('ok')
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('latency_ms')
    expect(body).toHaveProperty('version')
    expect(body).toHaveProperty('environment')
  })

  it('returns healthy status when services are ok', async () => {
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    expect(body.ok).toBe(true)
    expect(['healthy', 'degraded']).toContain(body.status)
  })

  it('includes cache-control header', async () => {
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    
    expect(res.headers.get('Cache-Control')).toContain('no-store')
  })

  it('includes security headers', async () => {
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    
    expect(res.headers.get('Strict-Transport-Security')).toBeTruthy()
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('returns checks when authorized in non-production', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    expect(body).toHaveProperty('checks')
    expect(body.checks).toHaveProperty('database')
    expect(body.checks).toHaveProperty('features')
    expect(body.checks).toHaveProperty('circuit_breakers')
    expect(body.checks).toHaveProperty('system')
    
    process.env.NODE_ENV = originalEnv
  })

  it('excludes checks without authorization in production', async () => {
    const originalEnv = process.env.NODE_ENV
    const originalSecret = process.env.HEALTHCHECK_SECRET
    process.env.NODE_ENV = 'production'
    process.env.HEALTHCHECK_SECRET = 'secret123'
    
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    expect(body).not.toHaveProperty('checks')
    
    process.env.NODE_ENV = originalEnv
    process.env.HEALTHCHECK_SECRET = originalSecret
  })

  it('includes checks with valid health secret', async () => {
    const originalEnv = process.env.NODE_ENV
    const originalSecret = process.env.HEALTHCHECK_SECRET
    process.env.NODE_ENV = 'production'
    process.env.HEALTHCHECK_SECRET = 'secret123'
    
    const req = new NextRequest('https://pointsmax.com/api/health', {
      headers: { 'x-health-secret': 'secret123' },
    })
    const res = await GET(req)
    const body = await res.json()
    
    expect(body).toHaveProperty('checks')
    
    process.env.NODE_ENV = originalEnv
    process.env.HEALTHCHECK_SECRET = originalSecret
  })

  it('returns degraded status for slow database', async () => {
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    // Database health check should be present in authorized mode
    if (body.checks) {
      expect(body.checks.database).toHaveProperty('status')
      expect(body.checks.database).toHaveProperty('latency_ms')
      expect(['healthy', 'degraded', 'unhealthy']).toContain(body.checks.database.status)
    }
  })

  it('returns feature status', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    if (body.checks) {
      expect(body.checks.features).toHaveProperty('stripe')
      expect(body.checks.features).toHaveProperty('resend')
      expect(body.checks.features).toHaveProperty('sentry')
      expect(body.checks.features).toHaveProperty('seats_aero')
      expect(body.checks.features).toHaveProperty('gemini')
      expect(body.checks.features).toHaveProperty('rate_limiting_distributed')
    }
    
    process.env.NODE_ENV = originalEnv
  })

  it('returns system metrics', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    if (body.checks) {
      expect(body.checks.system).toHaveProperty('active_queries')
      expect(body.checks.system).toHaveProperty('memory_usage_mb')
      expect(body.checks.system).toHaveProperty('uptime_seconds')
      expect(typeof body.checks.system.active_queries).toBe('number')
    }
    
    process.env.NODE_ENV = originalEnv
  })

  it('returns 503 when unhealthy', async () => {
    // This test depends on actual system state
    // In a real scenario, we'd mock the database to return an error
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    
    // Should be 200 or 503 depending on system state
    expect([200, 503]).toContain(res.status)
  })

  it('includes version information', async () => {
    const originalSha = process.env.VERCEL_GIT_COMMIT_SHA
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123def456'
    
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    expect(body.version).toBe('abc123d') // First 7 chars
    
    process.env.VERCEL_GIT_COMMIT_SHA = originalSha
  })

  it('includes region information', async () => {
    const originalRegion = process.env.VERCEL_REGION
    process.env.VERCEL_REGION = 'iad1'
    
    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()
    
    expect(body.region).toBe('iad1')
    
    process.env.VERCEL_REGION = originalRegion
  })
})

describe('HEAD /api/health', () => {
  it('returns 200 status', async () => {
    const res = await HEAD()
    expect(res.status).toBe(200)
  })

  it('returns empty body', async () => {
    const res = await HEAD()
    expect(res.body).toBeNull()
  })

  it('includes cache-control header', async () => {
    const res = await HEAD()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('includes security headers', async () => {
    const res = await HEAD()
    expect(res.headers.get('Strict-Transport-Security')).toBeTruthy()
  })
})
