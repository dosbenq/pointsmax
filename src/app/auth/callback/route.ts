import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase'
import { captureServerEvent } from '@/lib/posthog-server'
import { logWarn } from '@/lib/logger'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { NextResponse, type NextRequest } from 'next/server'

// A Supabase auth user created this recently is a new sign-up, not a returning login.
const SIGNUP_WINDOW_MS = 10 * 60 * 1000

async function trackSignup(
  authUser: { id: string; email?: string | null; created_at?: string },
  region: 'us' | 'in',
) {
  const createdAt = Date.parse(authUser.created_at ?? '')
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > SIGNUP_WINDOW_MS) return

  try {
    const { data } = await createAdminClient()
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .maybeSingle()
    const userId = (data as { id?: unknown } | null)?.id
    if (typeof userId !== 'string') return

    await captureServerEvent({
      distinctId: userId,
      event: 'user_signed_up',
      properties: { region, method: 'google' },
      setPersonProperties: authUser.email ? { email: authUser.email } : undefined,
      dedupeKey: `signup:${authUser.id}`,
      timestamp: new Date(createdAt).toISOString(),
    })
  } catch (error) {
    logWarn('signup_tracking_failed', { error: error instanceof Error ? error.message : String(error) })
  }
}

// GET /auth/callback
// Exchanges OAuth code for a session, then redirects to /calculator
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/us'
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
  const next = isValidPath(nextParam) ? nextParam : '/us'

  // Use the canonical app origin from env, not the request URL origin.
  // request.url can reflect internal Vercel routing URLs on some deployments,
  // causing redirects to go to the wrong host.
  const appOrigin = getConfiguredAppOrigin()

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await trackSignup(user, next.split('/').filter(Boolean)[0] === 'in' ? 'in' : 'us')
      }
      // Straight to where the person was going. (The onboarding page saved
      // nothing, so sending people there trapped them in a loop; balances and
      // home airport move into the new wallet step.)
      return NextResponse.redirect(`${appOrigin}${next}`)
    }
  }

  // Something went wrong: back home, where the error is shown.
  return NextResponse.redirect(`${appOrigin}/us?auth_error=1`)
}
