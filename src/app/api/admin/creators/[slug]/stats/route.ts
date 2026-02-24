import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

type ClickRow = {
  card_id: string | null
  created_at: string
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const { slug } = await context.params
  const db = createAdminClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: creator, error: creatorErr }, { data: clicks, error: clickErr }] = await Promise.all([
    db.from('creators').select('*').eq('slug', slug).maybeSingle(),
    db.from('affiliate_clicks')
      .select('card_id, created_at')
      .eq('creator_slug', slug)
      .gte('created_at', since),
  ])

  if (creatorErr || !creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
  }
  if (clickErr) {
    logError('admin_creator_stats_failed', { error: clickErr.message, slug })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const rows = (clicks ?? []) as ClickRow[]
  const clicksCount = rows.length
  const uniqueCards = new Set(rows.map((row) => row.card_id).filter(Boolean)).size
  const estimatedRevenue = clicksCount * 12

  return NextResponse.json({
    creator,
    window_days: 30,
    clicks: clicksCount,
    unique_cards_clicked: uniqueCards,
    estimated_revenue_usd: estimatedRevenue,
  })
}
