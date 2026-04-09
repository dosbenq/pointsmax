import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { NextResponse, type NextRequest } from 'next/server'

// GET /auth/callback
// Exchanges OAuth code for a session, then redirects to /calculator
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
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

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if user has completed onboarding (has a home airport)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
         const { data: prefs } = await supabase
           .from('user_preferences')
           .select('home_airport')
           .eq('id', user.id)
           .single()

         if (!prefs?.home_airport) {
           // Extract region from 'next' path (e.g. /in/calculator -> in)
           const pathParts = next.split('/').filter(Boolean)
           const region = pathParts[0] === 'in' ? 'in' : 'us'
           return NextResponse.redirect(`${appOrigin}/${region}/onboarding`)
         }
      }

      return NextResponse.redirect(`${appOrigin}${next}`)
    }
  }

  // Something went wrong — redirect to calculator with error flag
  return NextResponse.redirect(`${appOrigin}/us/calculator?auth_error=1`)
}
