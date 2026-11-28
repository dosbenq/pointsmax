// ============================================================
// PointsMax — sign-in (Better Auth with Google)
// Sessions and accounts live in our own Postgres (auth_* tables). The app's
// profile row in `users` links to the sign-in through users.auth_id.
// ============================================================

import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { eq, isNull, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { getDb, type Database } from '@/lib/db/client'
import { ensureDatabaseReady } from '@/lib/db/ready'
import { authAccount, authSession, authUser, authVerification, users } from '@/lib/db/schema'
import { logError } from '@/lib/logger'
import { getAuthBaseUrl } from '@/config/auth'
import type { AppUser } from '@/lib/auth-types'

export { getAuthBaseUrl }

export type SessionUser = AppUser

/**
 * Create the app profile for a sign-in, or link the existing one with the
 * same email. Profiles from before the move to Neon have no auth_id until
 * their owner's first Google sign-in, which links them here and keeps their
 * tier, Stripe customer and saved data.
 */
export async function ensureUserProfile(authId: string, email: string, db: Database = getDb()): Promise<void> {
  await db
    .insert(users)
    .values({ authId, email: email.trim().toLowerCase() })
    .onConflictDoUpdate({
      target: users.email,
      set: { authId },
      // Never move a profile that already belongs to a different sign-in.
      setWhere: or(isNull(users.authId), eq(users.authId, authId)),
    })
}

/** Exported for tests; the app uses getAuth(). */
export function createAuth(db: Database = getDb(), extra: Partial<BetterAuthOptions> = {}) {
  return betterAuth({
    appName: 'PointsMax',
    baseURL: getAuthBaseUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '',
        prompt: 'select_account',
      },
    },
    session: {
      // Re-check the session cookie against the database at most every 5 minutes.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      cookiePrefix: 'pm',
      database: { generateId: 'uuid' },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              await ensureUserProfile(user.id, user.email, db)
            } catch (error) {
              // getOrCreateUserRowId retries on the first request that needs the profile.
              logError('auth_profile_link_failed', { error: error instanceof Error ? error.message : String(error) })
            }
          },
        },
      },
    },
    plugins: [nextCookies()],
    ...extra,
  })
}

type Auth = ReturnType<typeof createAuth>

/** Built on first use so importing this module never opens a database connection. */
export function getAuth(): Auth {
  const g = globalThis as typeof globalThis & { __pointsmaxAuth?: Auth }
  if (!g.__pointsmaxAuth) g.__pointsmaxAuth = createAuth()
  return g.__pointsmaxAuth
}

/** The signed-in user for the current request, or null. Throws if the database is not ready. */
export async function getSessionUser(requestHeaders?: Headers): Promise<SessionUser | null> {
  await ensureDatabaseReady()
  try {
    const session = await getAuth().api.getSession({ headers: requestHeaders ?? await headers() })
    if (!session?.user) return null
    const { user } = session
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: Boolean(user.emailVerified),
      createdAt: new Date(user.createdAt).toISOString(),
    }
  } catch (error) {
    logError('auth_session_lookup_failed', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

/** The app profile id (users.id) for a sign-in, or null if none exists. */
export async function getUserRowId(authId: string): Promise<string | null> {
  const [row] = await getDb().select({ id: users.id }).from(users).where(eq(users.authId, authId)).limit(1)
  return row?.id ?? null
}

/** Profile id for a sign-in, creating or linking the profile if needed. */
export async function getOrCreateUserRowId(user: Pick<SessionUser, 'id' | 'email'>): Promise<string> {
  const existing = await getUserRowId(user.id)
  if (existing) return existing
  await ensureUserProfile(user.id, user.email)
  const created = await getUserRowId(user.id)
  if (!created) throw new Error('Failed to create user profile')
  return created
}

/** Signed-in user plus their profile id; profileId is null if no profile exists yet. */
export async function getAuthContext(requestHeaders?: Headers): Promise<{
  user: SessionUser | null
  authUserId: string | null
  profileId: string | null
}> {
  const user = await getSessionUser(requestHeaders)
  if (!user) return { user: null, authUserId: null, profileId: null }
  return { user, authUserId: user.id, profileId: await getUserRowId(user.id) }
}

