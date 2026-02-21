import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'

/**
 * Call at the top of every admin API route.
 * Returns a 403 NextResponse if the request is not from the admin user,
 * or null if the check passes.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = process.env.ADMIN_EMAIL
  if (!user || !adminEmail || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
