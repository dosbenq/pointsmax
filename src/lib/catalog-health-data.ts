import { asc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { cardEarningRates, cards } from '@/lib/db/schema'
import { buildCatalogHealthReport } from '@/lib/catalog-health'

/** Load active cards + earning rates and build the catalog health report. */
export async function loadCatalogHealthReport() {
  const db = getDb()
  const [cardRows, rateRows] = await Promise.all([
    db.select(columnsOf(cards)).from(cards).where(eq(cards.isActive, true)).orderBy(asc(cards.name)),
    db.select({ card_id: cardEarningRates.cardId, earn_multiplier: cardEarningRates.earnMultiplier }).from(cardEarningRates),
  ])
  return buildCatalogHealthReport(cardRows as Record<string, unknown>[], rateRows)
}
