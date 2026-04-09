import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase'
import { logError } from '@/lib/logger'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const { data, error } = await db
    .from('admin_audit_log')
    .select('id, admin_email, action, target_id, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    logError('admin_audit_log_fetch_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ rows: data ?? [] })
}
