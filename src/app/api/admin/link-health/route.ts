import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

type LinkHealthRow = {
  run_id: string
  card_id: string | null
  status_code: number | null
  ok: boolean
  checked_at: string
  url: string
  cards: { name: string } | { name: string }[] | null
}

type LatestRunRow = {
  run_id: string | null
}

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const summaryOnly = req.nextUrl.searchParams.get('summary') === '1'

  const { data: latestData, error: latestErr } = await db
    .from('link_health_log')
    .select('run_id')
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestErr) {
    logError('admin_link_health_latest_failed', { error: latestErr.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const latest = (latestData ?? null) as LatestRunRow | null

  if (!latest?.run_id) {
    return NextResponse.json({
      run_id: null,
      checked_at: null,
      totals: { checked: 0, broken: 0, healthy: 0 },
      rows: [],
    })
  }

  const { data, error } = await db
    .from('link_health_log')
    .select('run_id, card_id, status_code, ok, checked_at, url, cards(name)')
    .eq('run_id', latest.run_id)
    .order('ok', { ascending: true })
    .order('status_code', { ascending: false, nullsFirst: true })

  if (error) {
    logError('admin_link_health_fetch_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const rows = (data ?? []) as unknown as LinkHealthRow[]
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
      card_name: Array.isArray(row.cards) ? (row.cards[0]?.name ?? 'Unknown') : (row.cards?.name ?? 'Unknown'),
      url: row.url,
      status_code: row.status_code,
      ok: row.ok,
      checked_at: row.checked_at,
    })),
  })
}
