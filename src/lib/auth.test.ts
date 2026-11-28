// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/test/utils/test-db'
import { createAuth, getAuthBaseUrl } from './auth'

const ENV_KEYS = ['BETTER_AUTH_URL', 'NEXT_PUBLIC_APP_URL', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'BETTER_AUTH_SECRET'] as const
let saved: Partial<Record<(typeof ENV_KEYS)[number], string>>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('getAuthBaseUrl', () => {
  it('prefers an explicit app URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.example/some/path'
    process.env.VERCEL_URL = 'pointsmax-abc123.vercel.app'
    expect(getAuthBaseUrl()).toBe('https://pointsmax.example')
  })

  it('uses the production domain, not the per-deployment URL, in production', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'pointsmax-delta.vercel.app'
    process.env.VERCEL_URL = 'pointsmax-abc123.vercel.app'
    expect(getAuthBaseUrl()).toBe('https://pointsmax-delta.vercel.app')
  })

  it('falls back to the deployment URL on previews', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'pointsmax-delta.vercel.app'
    process.env.VERCEL_URL = 'pointsmax-abc123.vercel.app'
    expect(getAuthBaseUrl()).toBe('https://pointsmax-abc123.vercel.app')
  })
})

describe('Google sign-in start', () => {
  it('sends people to Google with our client id and the registered callback URL', async () => {
    process.env.VERCEL_ENV = 'production'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'pointsmax-delta.vercel.app'
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(40)

    const auth = createAuth(await createTestDb())
    const result = await auth.api.signInSocial({ body: { provider: 'google', callbackURL: '/us/calculator' } })

    const url = new URL(result.url!)
    expect(url.host).toBe('accounts.google.com')
    expect(url.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com')
    expect(url.searchParams.get('redirect_uri')).toBe('https://pointsmax-delta.vercel.app/api/auth/callback/google')
    expect(url.searchParams.get('state')).toBeTruthy()
  })
})
