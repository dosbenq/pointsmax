import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api-security'
import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const rateLimitError = await enforceRateLimit(request, {
    namespace: 'user_ping_ip',
    maxRequests: 30,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: userRow } = await db.from('users').select('id').eq('auth_id', user.id).single()
  const internalUserId = (userRow as { id?: unknown } | null)?.id
  if (typeof internalUserId !== 'string') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  await db.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', internalUserId)
  return NextResponse.json({ ok: true })
}
