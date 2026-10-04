import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  try {
    const rows = await getDb()
      .select({
        id: users.id,
        email: users.email,
        tier: users.tier,
        stripe_customer_id: users.stripeCustomerId,
        created_at: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
    return NextResponse.json({ users: rows })
  } catch (error) {
    console.error('admin_users_list_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

const VALID_TIERS = ['free', 'premium'] as const

export async function PATCH(request: Request) {
  const { error: authError, adminEmail } = await requireAdmin(request)
  if (authError) return authError

  const { user_id, tier } = await request.json()
  if (!user_id || !tier) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    await getDb().update(users).set({ tier }).where(eq(users.id, user_id))
  } catch (error) {
    console.error('admin_users_update_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  await logAdminAction('user.tier_update', String(user_id), { tier }, adminEmail!)
  return NextResponse.json({ ok: true })
}
