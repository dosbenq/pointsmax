import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { error: authError, adminEmail } = await requireAdmin(request)
  if (authError) return authError

  const { id } = await context.params
  const db = createAdminClient()

  const { error } = await db.from('transfer_bonuses').delete().eq('id', id)
  if (error) {
    console.error('admin_bonus_delete_failed', { bonus_id: id, error: error.message })
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

  const db = createAdminClient()
  const update =
    action === 'verify'
      ? { verified: true, is_verified: true, active: true }
      : { verified: false, is_verified: false, active: false }

  const { error } = await db
    .from('transfer_bonuses')
    .update(update as never)
    .eq('id', id)
  if (error) {
    console.error('admin_bonus_update_failed', { bonus_id: id, action, error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  await logAdminAction(`bonus.${action}`, id, update as Record<string, unknown>, adminEmail!)

  return NextResponse.json({ ok: true, action })
}
