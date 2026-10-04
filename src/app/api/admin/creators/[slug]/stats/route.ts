import { NextResponse } from 'next/server'
import { and, eq, gte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { affiliateClicks, creatorConversions, creators } from '@/lib/db/schema'
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
  const db = getDb()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let creator: Record<string, unknown> | undefined
  let rows: ClickRow[]
  let conversionRows: ConversionRow[]
  try {
    ;[[creator], rows, conversionRows] = await Promise.all([
      db.select(columnsOf(creators)).from(creators).where(eq(creators.slug, slug)).limit(1),
      db.select({ card_id: affiliateClicks.cardId, created_at: affiliateClicks.createdAt })
        .from(affiliateClicks)
        .where(and(eq(affiliateClicks.creatorSlug, slug), gte(affiliateClicks.createdAt, since))) as Promise<ClickRow[]>,
      db.select({ revenue_usd: creatorConversions.revenueUsd })
        .from(creatorConversions)
        .where(and(eq(creatorConversions.creatorSlug, slug), gte(creatorConversions.convertedAt, since))) as Promise<ConversionRow[]>,
    ])
  } catch (error) {
    logError('admin_creator_stats_failed', { error: error instanceof Error ? error.message : String(error), slug })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
  }

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
