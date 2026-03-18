import { afterEach, describe, expect, it, vi } from 'vitest'

describe('supabase env helpers', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole
    vi.resetModules()
    vi.doUnmock('@supabase/supabase-js')
  })

  it('reports missing public env as unavailable', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const mod = await import('./supabase')
    expect(mod.hasConfiguredPublicSupabaseEnv()).toBe(false)
  })

  it('reports configured public env as available', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    const mod = await import('./supabase')
    expect(mod.hasConfiguredPublicSupabaseEnv()).toBe(true)
  })

  it('uses the public client by default even when service role is configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    const createClientMock = vi.fn(() => ({ client: true }))
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: createClientMock,
    }))

    const mod = await import('./supabase')
    mod.createServerDbClient()

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.any(Object),
    )
  })

  it('only uses the service role client with explicit opt-in', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    const createClientMock = vi.fn(() => ({ client: true }))
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: createClientMock,
    }))

    const mod = await import('./supabase')
    mod.createServerDbClient({ useServiceRole: true })

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.any(Object),
    )
  })
})
