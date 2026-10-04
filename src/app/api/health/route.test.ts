// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { setDbForTesting } from '@/lib/db/client'
import { createTestDb } from '@/test/utils/test-db'

beforeAll(async () => setDbForTesting(await createTestDb()))
afterAll(() => setDbForTesting(null))

const { GET, HEAD } = await import('./route')

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

  it('reports unhealthy (503) when the database is unreachable', async () => {
    const realDb = await createTestDb()
    await realDb.$client.close()
    setDbForTesting(realDb)
    try {
      const res = await GET(new NextRequest('https://pointsmax.com/api/health'))
      expect(res.status).toBe(503)
      expect((await res.json()).status).toBe('unhealthy')
    } finally {
      setDbForTesting(await createTestDb())
    }
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
    expect(body.checks).toHaveProperty('telemetry')

    process.env.NODE_ENV = originalEnv
  })

  it('returns telemetry metrics', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()

    if (body.checks) {
      expect(body.checks).toHaveProperty('telemetry')
      expect(body.checks.telemetry).toHaveProperty('ai')
      expect(body.checks.telemetry).toHaveProperty('queue')
      expect(body.checks.telemetry).toHaveProperty('errors')
      expect(body.checks.telemetry.ai).toHaveProperty('avg_latency_ms')
      expect(body.checks.telemetry.queue).toHaveProperty('avg_processing_time_ms')
    }

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

  it('includes version information', async () => {
    const originalSha = process.env.VERCEL_GIT_COMMIT_SHA
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123def456'

    const req = new NextRequest('https://pointsmax.com/api/health')
    const res = await GET(req)
    const body = await res.json()

    expect(body.version).toBe('abc123d')

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
    expect(res.headers.get('Cache-Control')).toContain('no-store')
  })

  it('includes security headers', async () => {
    const res = await HEAD()
    expect(res.headers.get('Strict-Transport-Security')).toBeTruthy()
  })
})
