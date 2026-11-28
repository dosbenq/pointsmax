// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getUserMock, userRowMock, captureServerEventMock, inngestSendMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  userRowMock: vi.fn(),
  captureServerEventMock: vi.fn(),
  inngestSendMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}))
vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: userRowMock }) }) }),
  }),
}))
vi.mock('@/lib/posthog-server', () => ({ captureServerEvent: captureServerEventMock }))
vi.mock('@/lib/inngest/client', () => ({ inngest: { send: inngestSendMock } }))

const { POST } = await import('./route')

function post(body: unknown) {
  return POST(new NextRequest('http://localhost/api/onboarding/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('POST /api/onboarding/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-1' } } })
    userRowMock.mockResolvedValue({ data: { id: 'user-1' } })
  })

  it('requires a signed-in user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect((await post({ region: 'us' })).status).toBe(401)
    expect(captureServerEventMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the profile row is missing', async () => {
    userRowMock.mockResolvedValue({ data: null })
    expect((await post({ region: 'us' })).status).toBe(404)
  })

  it('records onboarding in analytics without starting an email sequence', async () => {
    const res = await post({ region: 'in', home_airport: ' del ' })

    expect(res.status).toBe(200)
    expect(captureServerEventMock).toHaveBeenCalledWith(expect.objectContaining({
      distinctId: 'user-1',
      event: 'onboarding_completed',
      properties: { region: 'in', home_airport: 'DEL' },
    }))
    expect(inngestSendMock).not.toHaveBeenCalled()
  })
})
