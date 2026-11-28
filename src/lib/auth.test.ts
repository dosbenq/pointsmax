// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { authUser, userBalances, users } from '@/lib/db/schema'
import { createTestDb } from '@/test/utils/test-db'
import { createAuth, ensureUserProfile, getAuthBaseUrl } from './auth'

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

describe('linking a copied profile on first sign-in', () => {
  const COPIED_ID = '11111111-1111-4111-8111-111111111111'

  async function setup() {
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(40)
    const db = await createTestDb()
    // A profile from before the move to Neon: no sign-in yet, premium, with saved data.
    await db.insert(users).values({ id: COPIED_ID, email: 'alice@example.com', tier: 'premium', stripeCustomerId: 'cus_alice' })
    await db.insert(userBalances).values({ userId: COPIED_ID, programId: '22222222-2222-4222-8222-222222222222', balance: 120000 })
    // Email/password stands in for Google here: both create the sign-in through the same hook.
    const auth = createAuth(db, { plugins: [], emailAndPassword: { enabled: true } })
    return { db, auth }
  }

  it('links by email regardless of letter case and keeps tier, Stripe customer and balances', async () => {
    const { db, auth } = await setup()

    const { user } = await auth.api.signUpEmail({ body: { email: 'Alice@Example.COM', password: 'correct-horse-battery', name: 'Alice' } })

    const profiles = await db.select().from(users)
    expect(profiles).toHaveLength(1)
    expect(profiles[0]).toMatchObject({ id: COPIED_ID, authId: user.id, tier: 'premium', stripeCustomerId: 'cus_alice' })
    expect(await db.select().from(userBalances)).toEqual([expect.objectContaining({ userId: COPIED_ID, balance: 120000 })])
  })

  it('creates a fresh profile for someone new', async () => {
    const { db, auth } = await setup()

    const { user } = await auth.api.signUpEmail({ body: { email: 'new@example.com', password: 'correct-horse-battery', name: 'New' } })

    const [profile] = await db.select().from(users).where(eq(users.authId, user.id))
    expect(profile).toMatchObject({ email: 'new@example.com', tier: 'free' })
  })

  it('never moves a profile that already belongs to another sign-in', async () => {
    const { db } = await setup()
    const other = '33333333-3333-4333-8333-333333333333'
    await db.insert(authUser).values({ id: other, name: 'Other', email: 'other@example.com' })
    await db.update(users).set({ authId: other }).where(eq(users.id, COPIED_ID))

    const intruder = '44444444-4444-4444-8444-444444444444'
    await db.insert(authUser).values({ id: intruder, name: 'Intruder', email: 'intruder@example.com' })
    await ensureUserProfile(intruder, 'ALICE@example.com', db)

    const [profile] = await db.select().from(users).where(eq(users.id, COPIED_ID))
    expect(profile.authId).toBe(other)
  })
})
