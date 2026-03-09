import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse, type NextRequest } from 'next/server'

// GET /auth/callback
// Exchanges OAuth code for a session, then redirects to /calculator
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/calculator'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/calculator'

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
           return NextResponse.redirect(`${origin}/${region}/onboarding`)
         }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — redirect to calculator with error flag
  return NextResponse.redirect(`${origin}/calculator?auth_error=1`)
}
