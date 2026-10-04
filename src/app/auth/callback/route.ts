import { eq } from 'drizzle-orm'
import { getOrCreateUserRowId, getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { userPreferences } from '@/lib/db/schema'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { NextResponse, type NextRequest } from 'next/server'

// GET /auth/callback
// Post-sign-in landing. Better Auth completes the Google OAuth exchange at
// /api/auth/callback/google and then redirects here; we send first-time users
// to onboarding and everyone else to `next`.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const nextParam = searchParams.get('next') ?? '/us/calculator'
  // Validate: must be relative path, no protocol-relative, no encoded sequences that could redirect
  const isValidPath = (p: string) => {
    if (!p.startsWith('/') || p.startsWith('//')) return false
    // Reject any URL-encoded slashes or backslashes that could bypass validation
    if (/%2f/i.test(p) || /%5c/i.test(p) || p.includes('\\')) return false
    // Ensure it doesn't contain protocol indicators
    try {
      const url = new URL(p, 'http://localhost')
      if (url.hostname !== 'localhost') return false
    } catch {
      return false
    }
    return true
  }
  const next = isValidPath(nextParam) ? nextParam : '/us/calculator'

  // Use the canonical app origin from env, not the request URL origin.
  // request.url can reflect internal Vercel routing URLs on some deployments,
  // causing redirects to go to the wrong host.
  const appOrigin = getConfiguredAppOrigin()

  const user = await getSessionUser(request.headers)
  if (user) {
    try {
      const userRowId = await getOrCreateUserRowId(user)
      const [prefs] = await getDb()
        .select({ home_airport: userPreferences.homeAirport })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userRowId))
        .limit(1)

      if (!prefs?.home_airport) {
        // Extract region from 'next' path (e.g. /in/calculator -> in)
        const pathParts = next.split('/').filter(Boolean)
        const region = pathParts[0] === 'in' ? 'in' : 'us'
        return NextResponse.redirect(`${appOrigin}/${region}/onboarding`)
      }
    } catch {
      // Profile lookup problems should not block a successful sign-in.
    }

    return NextResponse.redirect(`${appOrigin}${next}`)
  }

  // Something went wrong — redirect to calculator with error flag
  return NextResponse.redirect(`${appOrigin}/us/calculator?auth_error=1`)
}
