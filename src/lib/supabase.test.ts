import { afterEach, describe, expect, it, vi } from 'vitest'

describe('supabase env helpers', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon
    vi.resetModules()
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
})
