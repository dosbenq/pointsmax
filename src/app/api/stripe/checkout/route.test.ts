import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}))

const { POST } = await import('./route')

const saved = process.env.PRO_CHECKOUT_ENABLED
afterEach(() => {
  if (saved === undefined) delete process.env.PRO_CHECKOUT_ENABLED
  else process.env.PRO_CHECKOUT_ENABLED = saved
})

describe('POST /api/stripe/checkout', () => {
  it('is closed to new sign-ups unless explicitly reopened', async () => {
    delete process.env.PRO_CHECKOUT_ENABLED
    const res = await POST(new NextRequest('http://localhost/api/stripe/checkout', { method: 'POST' }))

    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/paused/)
    expect(getUserMock).not.toHaveBeenCalled()
  })
})
