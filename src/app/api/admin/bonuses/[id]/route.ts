import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { id } = await context.params
  const db = createAdminClient()

  const { error } = await db.from('transfer_bonuses').delete().eq('id', id)
  if (error) {
    console.error('admin_bonus_delete_failed', { bonus_id: id, error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
