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
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — redirect to calculator with error flag
  return NextResponse.redirect(`${origin}/calculator?auth_error=1`)
}
