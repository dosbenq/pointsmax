import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

type ClickRow = {
  card_id: string | null
  created_at: string
}

type ConversionRow = {
  revenue_usd: number | null
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authError

  const { slug } = await context.params
  const db = createAdminClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: creator, error: creatorErr },
    { data: clicks, error: clickErr },
    { data: conversions, error: conversionErr },
  ] = await Promise.all([
    db.from('creators').select('*').eq('slug', slug).maybeSingle(),
    db.from('affiliate_clicks')
      .select('card_id, created_at')
      .eq('creator_slug', slug)
      .gte('created_at', since),
    db.from('creator_conversions')
      .select('revenue_usd')
      .eq('creator_slug', slug)
      .gte('converted_at', since),
  ])

  if (creatorErr || !creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
  }
  if (clickErr || conversionErr) {
    logError('admin_creator_stats_failed', { error: clickErr?.message ?? conversionErr?.message, slug })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const rows = (clicks ?? []) as ClickRow[]
  const conversionRows = (conversions ?? []) as ConversionRow[]
  const clicksCount = rows.length
  const uniqueCards = new Set(rows.map((row) => row.card_id).filter(Boolean)).size
  const conversionsCount = conversionRows.length
  const totalRevenueUsd = conversionRows.reduce((sum, row) => sum + ((row.revenue_usd ?? 0) / 100), 0)

  return NextResponse.json({
    creator,
    window_days: 30,
    clicks: clicksCount,
    conversions: conversionsCount,
    conversion_rate: clicksCount > 0 ? Number((conversionsCount / clicksCount * 100).toFixed(1)) : 0,
    unique_cards_clicked: uniqueCards,
    estimated_revenue_usd: Number(totalRevenueUsd.toFixed(2)),
  })
}
