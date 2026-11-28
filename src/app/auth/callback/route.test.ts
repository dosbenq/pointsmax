import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { exchangeMock, getUserMock } = vi.hoisted(() => ({ exchangeMock: vi.fn(), getUserMock: vi.fn() }))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession: exchangeMock, getUser: getUserMock } }),
}))
vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
}))
vi.mock('@/lib/posthog-server', () => ({ captureServerEvent: vi.fn() }))

const { GET } = await import('./route')

const ORIGIN = 'https://pointsmax.test' // NEXT_PUBLIC_APP_URL in vitest.setup.ts
const land = async (query: string) => (await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`))).headers.get('location')

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = ORIGIN
    exchangeMock.mockResolvedValue({ error: null })
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-1', email: 'pat@example.com', created_at: '2020-01-01T00:00:00Z' } } })
  })

  it('sends a signed-in person straight to where they were going (no onboarding loop)', async () => {
    expect(await land('?code=abc&next=/in/award-search')).toBe(`${ORIGIN}/in/award-search`)
    expect(exchangeMock).toHaveBeenCalledWith('abc')
  })

  it('ignores next paths that could leave the site', async () => {
    expect(await land(`?code=abc&next=${encodeURIComponent('//evil.example')}`)).toBe(`${ORIGIN}/us`)
  })

  it('reports a failed code exchange', async () => {
    exchangeMock.mockResolvedValue({ error: { message: 'invalid flow state' } })
    expect(await land('?code=abc')).toBe(`${ORIGIN}/us?auth_error=1`)
  })
})
