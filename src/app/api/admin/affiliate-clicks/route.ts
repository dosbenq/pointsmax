import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

type ClickRow = {
  card_id: string | null
  source_page: string | null
  creator_slug: string | null
  region: string | null
  rank: number | null
  created_at: string
  cards: { name: string } | { name: string }[] | null
}

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const db = createAdminClient()

  const { data, error } = await db
    .from('affiliate_clicks')
    .select('card_id, source_page, creator_slug, region, rank, created_at, cards(name)')
    .gte('created_at', windowStart)

  if (error) {
    logError('admin_affiliate_clicks_fetch_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const counts = new Map<string, {
    card_id: string;
    card_name: string;
    source_page: string;
    creator_slug: string | null;
    region: string | null;
    clicks: number
  }>()

  for (const row of (data ?? []) as unknown as ClickRow[]) {
    if (!row.card_id) continue
    const cardName = Array.isArray(row.cards)
      ? (row.cards[0]?.name ?? 'Unknown card')
      : (row.cards?.name ?? 'Unknown card')
    const sourcePage = row.source_page ?? 'unknown'
    const creatorSlug = row.creator_slug ?? null
    const region = row.region ?? 'unknown'
    const key = `${row.card_id}:${sourcePage}:${creatorSlug ?? 'none'}:${region}`
    const current = counts.get(key)
    if (current) {
      current.clicks += 1
      continue
    }
    counts.set(key, {
      card_id: row.card_id,
      card_name: cardName,
      source_page: sourcePage,
      creator_slug: creatorSlug,
      region: row.region,
      clicks: 1,
    })
  }

  return NextResponse.json({
    window_days: 30,
    rows: [...counts.values()].sort((a, b) => b.clicks - a.clicks),
  })
}
