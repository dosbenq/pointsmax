import { NextRequest, NextResponse } from 'next/server'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { cards, linkHealthLog } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = getDb()
  const summaryOnly = req.nextUrl.searchParams.get('summary') === '1'

  let latest: { run_id: string } | undefined
  let rows: Array<{
    run_id: string
    card_id: string | null
    status_code: number | null
    ok: boolean
    checked_at: string
    url: string
    card_name: string | null
  }> = []
  try {
    ;[latest] = await db
      .select({ run_id: linkHealthLog.runId })
      .from(linkHealthLog)
      .orderBy(desc(linkHealthLog.checkedAt))
      .limit(1)

    if (latest?.run_id) {
      rows = await db
        .select({
          run_id: linkHealthLog.runId,
          card_id: linkHealthLog.cardId,
          status_code: linkHealthLog.statusCode,
          ok: linkHealthLog.ok,
          checked_at: linkHealthLog.checkedAt,
          url: linkHealthLog.url,
          card_name: cards.name,
        })
        .from(linkHealthLog)
        .leftJoin(cards, eq(cards.id, linkHealthLog.cardId))
        .where(eq(linkHealthLog.runId, latest.run_id))
        .orderBy(asc(linkHealthLog.ok), sql`${linkHealthLog.statusCode} desc nulls first`)
    }
  } catch (error) {
    logError('admin_link_health_fetch_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  if (!latest?.run_id) {
    return NextResponse.json({
      run_id: null,
      checked_at: null,
      totals: { checked: 0, broken: 0, healthy: 0 },
      rows: [],
    })
  }

  const checkedAt = rows[0]?.checked_at ?? null
  const broken = rows.filter((row) => !row.ok).length
  const totals = {
    checked: rows.length,
    broken,
    healthy: rows.length - broken,
  }

  if (summaryOnly) {
    return NextResponse.json({
      run_id: latest.run_id,
      checked_at: checkedAt,
      totals,
    })
  }

  return NextResponse.json({
    run_id: latest.run_id,
    checked_at: checkedAt,
    totals,
    rows: rows.map((row) => ({
      card_id: row.card_id,
      card_name: row.card_name ?? 'Unknown',
      url: row.url,
      status_code: row.status_code,
      ok: row.ok,
      checked_at: row.checked_at,
    })),
  })
}
