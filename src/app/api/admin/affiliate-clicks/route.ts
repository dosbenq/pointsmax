import { NextResponse } from 'next/server'
import { eq, gte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { affiliateClicks, cards } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'


export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  let data: Array<{
    card_id: string | null
    source_page: string | null
    creator_slug: string | null
    region: string | null
    card_name: string | null
  }>
  try {
    data = await getDb()
      .select({
        card_id: affiliateClicks.cardId,
        source_page: affiliateClicks.sourcePage,
        creator_slug: affiliateClicks.creatorSlug,
        region: affiliateClicks.region,
        card_name: cards.name,
      })
      .from(affiliateClicks)
      .leftJoin(cards, eq(cards.id, affiliateClicks.cardId))
      .where(gte(affiliateClicks.createdAt, windowStart))
  } catch (error) {
    logError('admin_affiliate_clicks_fetch_failed', { error: error instanceof Error ? error.message : String(error) })
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

  for (const row of data) {
    if (!row.card_id) continue
    const cardName = row.card_name ?? 'Unknown card'
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
