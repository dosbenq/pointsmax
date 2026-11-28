import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthBaseUrl, getOrCreateUserRowId, getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { captureServerEvent } from '@/lib/posthog-server'
import { logWarn } from '@/lib/logger'

// A profile created this recently is a new sign-up, not a returning login.
// (Profiles copied from Supabase keep their original created_at.)
const SIGNUP_WINDOW_MS = 10 * 60 * 1000

/** A same-site relative path only: no protocol-relative or encoded tricks that could leave the site. */
const isSafeNextPath = (p: string, origin: string) => {
  if (!p.startsWith('/') || p.startsWith('//')) return false
  // Reject URL-encoded slashes or backslashes that could bypass validation
  if (/%2f/i.test(p) || /%5c/i.test(p) || p.includes('\\')) return false
  try {
    return new URL(p, origin).origin === origin
  } catch {
    return false
  }
}

// GET /auth/callback
// Post-sign-in landing. Better Auth completes the Google exchange at
// /api/auth/callback/google and redirects here; everyone goes straight to
// `next` (home airport and balances live in the wallet step).
export async function GET(request: NextRequest) {
  const nextParam = request.nextUrl.searchParams.get('next') ?? '/us'
  const next = isSafeNextPath(nextParam, request.nextUrl.origin) ? nextParam : '/us'
  const region = next.split('/').filter(Boolean)[0] === 'in' ? 'in' : 'us'
  // The sign-in cookie lives on the auth origin, so stay on it.
  const appOrigin = getAuthBaseUrl()

  let user
  try {
    user = await getSessionUser(request.headers)
  } catch {
    user = null
  }
  if (!user) return NextResponse.redirect(`${appOrigin}/us?auth_error=1`)

  try {
    const userRowId = await getOrCreateUserRowId(user)
    const db = getDb()
    const [profile] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userRowId)).limit(1)
    const createdAt = Date.parse(profile?.createdAt ?? '')
    if (Number.isFinite(createdAt) && Date.now() - createdAt <= SIGNUP_WINDOW_MS) {
      try {
        await captureServerEvent({
          distinctId: userRowId,
          event: 'user_signed_up',
          properties: { region, method: 'google' },
          setPersonProperties: { email: user.email },
          dedupeKey: `signup:${userRowId}`,
          timestamp: new Date(createdAt).toISOString(),
        })
      } catch (error) {
        logWarn('signup_tracking_failed', { error: error instanceof Error ? error.message : String(error) })
      }
    }

  } catch (error) {
    // Profile problems must not block a successful sign-in.
    logWarn('auth_callback_profile_failed', { error: error instanceof Error ? error.message : String(error) })
  }

  return NextResponse.redirect(`${appOrigin}${next}`)
}
