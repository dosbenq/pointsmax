import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError

  const db = createAdminClient()
  const { data, error } = await db
    .from('users')
    .select('id, email, tier, stripe_customer_id, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { user_id, tier } = await request.json()
  if (!user_id || !tier) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db.from('users').update({ tier }).eq('id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
