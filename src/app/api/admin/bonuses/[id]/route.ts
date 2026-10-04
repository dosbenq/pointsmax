import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { transferBonuses } from '@/lib/db/schema'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { error: authError, adminEmail } = await requireAdmin(request)
  if (authError) return authError

  const { id } = await context.params
  try {
    await getDb().delete(transferBonuses).where(eq(transferBonuses.id, id))
  } catch (error) {
    console.error('admin_bonus_delete_failed', { bonus_id: id, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  await logAdminAction('bonus.delete', id, {}, adminEmail!)
  return NextResponse.json({ ok: true })
}

type UpdateActionBody = {
  action?: unknown
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { error: authError, adminEmail } = await requireAdmin(request)
  if (authError) return authError

  const { id } = await context.params
  let body: UpdateActionBody
  try {
    body = (await request.json()) as UpdateActionBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : ''
  if (action !== 'verify' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be verify or reject' }, { status: 400 })
  }

  const verified = action === 'verify'
  try {
    await getDb()
      .update(transferBonuses)
      .set({ verified, isVerified: verified, active: verified })
      .where(eq(transferBonuses.id, id))
  } catch (error) {
    console.error('admin_bonus_update_failed', { bonus_id: id, action, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  await logAdminAction(`bonus.${action}`, id, { verified, is_verified: verified, active: verified }, adminEmail!)

  return NextResponse.json({ ok: true, action })
}
