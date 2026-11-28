// ============================================================
// PointsMax — sign-in (Better Auth with Google)
// Sessions and accounts live in our own Postgres (auth_* tables). The app's
// profile row in `users` links to the sign-in through users.auth_id.
// ============================================================

import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { getDb, type Database } from '@/lib/db/client'
import { authAccount, authSession, authUser, authVerification } from '@/lib/db/schema'

function toOrigin(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const value = raw.trim()
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).origin
  } catch {
    return null
  }
}

/**
 * The public origin Google redirects back to. It must match the redirect URI
 * registered on the Google OAuth client exactly, so production uses the
 * project's production domain rather than the per-deployment URL.
 */
export function getAuthBaseUrl(): string {
  return (
    toOrigin(process.env.BETTER_AUTH_URL) ||
    toOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    (process.env.VERCEL_ENV === 'production' ? toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) : null) ||
    toOrigin(process.env.VERCEL_URL) ||
    `http://localhost:${process.env.PORT ?? 3000}`
  )
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
