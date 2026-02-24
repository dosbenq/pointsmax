import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const authError = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const { data, error } = await db
    .from('users')
    .select('id, email, tier, stripe_customer_id, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('admin_users_list_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ users: data ?? [] })
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const { user_id, tier } = await request.json()
  if (!user_id || !tier) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db.from('users').update({ tier } as never).eq('id', user_id)

  if (error) {
    console.error('admin_users_update_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  await logAdminAction('user.tier_update', String(user_id), { tier })
  return NextResponse.json({ ok: true })
}
