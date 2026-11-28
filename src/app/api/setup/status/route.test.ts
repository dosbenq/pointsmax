import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api-security', () => ({ enforceRateLimit: vi.fn(async () => null) }))
vi.mock('@/lib/setup-status', () => ({
  getSetupStatus: vi.fn(async () => ({
    configured: { database_url: true, google_oauth: true, auth_secret: true },
    google: { ok: true },
    schema: { ok: true, migrations: 1, applied_now: [] },
    checked_at: '2026-11-28T00:00:00.000Z',
  })),
}))

const { GET } = await import('./route')

describe('GET /api/setup/status', () => {
  it('returns the self-check report uncached', async () => {
    const res = await GET(new NextRequest('https://pointsmax.com/api/setup/status'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(body.schema.ok).toBe(true)
    expect(body.google).toEqual({ ok: true })
  })
})
