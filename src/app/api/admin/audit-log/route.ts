import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin-auth'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { adminAuditLog } from '@/lib/db/schema'
import { logError } from '@/lib/logger'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  try {
    const rows = await getDb()
      .select(columnsOf(adminAuditLog))
      .from(adminAuditLog)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(100)
    return NextResponse.json({ rows })
  } catch (error) {
    logError('admin_audit_log_fetch_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
