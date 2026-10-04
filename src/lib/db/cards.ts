// ============================================================
// Cards Repository — DB-backed card catalog access
// ============================================================

import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { cardEarningRates, cards, latestValuations, programs } from '@/lib/db/schema'
import type { CardWithRates, SpendCategory } from '@/types/database'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { logError } from '@/lib/logger'

export type Geography = 'US' | 'IN'

interface CardRow {
  id: string
  name: string
  issuer: string
  annual_fee_usd: number
  signup_bonus_pts: number
  signup_bonus_spend: number
  program_id: string
  is_active: boolean
  display_order: number
  created_at: string
  image_url?: unknown
  currency?: unknown
  earn_unit?: unknown
  geography?: unknown
  apply_url?: unknown
  earning_rates?: unknown
  top_perks?: unknown
  community_sentiment?: unknown
  ideal_for?: unknown
  recent_changes?: unknown
  expert_summary?: unknown
  sources?: unknown
  welcome_benefit?: unknown
}

interface ValuationRow {
  program_id: string
  cpp_cents: number | null
  program_name: string
  program_slug: string
  program_type: string
}

interface RateRow {
  card_id: string
  category: string
  earn_multiplier: number
}

const defaultRates: Record<SpendCategory, number> = {
  dining: 1,
  groceries: 1,
  travel: 1,
  gas: 1,
  shopping: 1,
  streaming: 1,
  other: 1,
}

function buildCardWithRates(
  card: CardRow,
  valuation: ValuationRow | undefined,
  earningRates: Record<SpendCategory, number> | undefined,
): CardWithRates {
  const currency = card.currency === 'INR' ? 'INR' : 'USD'
  const rates = earningRates ?? { ...defaultRates }

  if (!Number.isFinite(rates.shopping) || rates.shopping <= 0) {
    rates.shopping = rates.other
  }

  return {
    ...card,
    currency,
    earn_unit: typeof card.earn_unit === 'string'
      ? card.earn_unit
      : (currency === 'INR' ? '100_inr' : '1_dollar'),
    geography: card.geography === 'IN' ? 'IN' : 'US',
    apply_url: typeof card.apply_url === 'string' ? card.apply_url : null,
    image_url: typeof card.image_url === 'string' ? card.image_url : null,
    program_name: valuation?.program_name ?? 'Unknown',
    program_slug: valuation?.program_slug ?? '',
    cpp_cents: resolveCppCents(valuation?.cpp_cents, valuation?.program_type, valuation?.program_slug),
    earning_rates: rates,
    top_perks: typeof card.top_perks === 'string' ? card.top_perks : null,
    community_sentiment: typeof card.community_sentiment === 'string' ? card.community_sentiment : null,
    ideal_for: typeof card.ideal_for === 'string' ? card.ideal_for : null,
    recent_changes: typeof card.recent_changes === 'string' ? card.recent_changes : null,
    expert_summary: typeof card.expert_summary === 'string' ? card.expert_summary : null,
    sources: typeof card.sources === 'string' ? card.sources : null,
    welcome_benefit: typeof card.welcome_benefit === 'string' ? card.welcome_benefit : null,
  }
}

function buildRatesByCard(rates: RateRow[]): Map<string, Record<SpendCategory, number>> {
  const ratesByCard = new Map<string, Record<SpendCategory, number>>()

  for (const rate of rates) {
    if (!ratesByCard.has(rate.card_id)) {
      ratesByCard.set(rate.card_id, { ...defaultRates })
    }

    const existing = ratesByCard.get(rate.card_id)!
    const category = rate.category as SpendCategory
    if (category in existing) {
      existing[category] = Number(rate.earn_multiplier)
    }
  }

  return ratesByCard
}

export function normalizeGeography(value: string | null): Geography {
  if (!value) return 'US'
  return value.toUpperCase() === 'IN' ? 'IN' : 'US'
}

async function loadCardMetadata(cardRows: CardRow[]) {
  const db = getDb()
  const cardIds = cardRows.map((card) => card.id)
  const programIds = [...new Set(cardRows.map((card) => card.program_id))]

  const [valuationRows, rateRows] = await Promise.all([
    db
      .select({
        program_id: programs.id,
        program_name: programs.name,
        program_slug: programs.slug,
        program_type: programs.type,
        cpp_cents: latestValuations.cppCents,
      })
      .from(programs)
      .leftJoin(latestValuations, eq(latestValuations.programId, programs.id))
      .where(inArray(programs.id, programIds)),
    db
      .select({
        card_id: cardEarningRates.cardId,
        category: cardEarningRates.category,
        earn_multiplier: cardEarningRates.earnMultiplier,
      })
      .from(cardEarningRates)
      .where(inArray(cardEarningRates.cardId, cardIds)),
  ])

  return {
    valuationByProgram: new Map(valuationRows.map((row) => [row.program_id, row as ValuationRow])),
    ratesByCard: buildRatesByCard(rateRows as RateRow[]),
  }
}

export async function getActiveCards(geography: Geography): Promise<CardWithRates[]> {
  let cardRows: CardRow[]
  try {
    cardRows = await getDb()
      .select(columnsOf(cards))
      .from(cards)
      .where(and(eq(cards.isActive, true), eq(cards.geography, geography)))
      .orderBy(asc(cards.displayOrder)) as unknown as CardRow[]
  } catch (error) {
    logError('cards_repository_fetch_failed', {
      geography,
      cards_error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('Failed to fetch cards')
  }

  if (cardRows.length === 0) return []

  try {
    const { valuationByProgram, ratesByCard } = await loadCardMetadata(cardRows)
    return cardRows.map((card) => buildCardWithRates(card, valuationByProgram.get(card.program_id), ratesByCard.get(card.id)))
  } catch (error) {
    logError('cards_repository_fetch_failed', {
      geography,
      metadata_error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('Failed to fetch card metadata')
  }
}

export async function getCardById(cardId: string): Promise<CardWithRates | null> {
  let card: CardRow | undefined
  try {
    const rows = await getDb()
      .select(columnsOf(cards))
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.isActive, true)))
      .limit(1)
    card = rows[0] as unknown as CardRow | undefined
  } catch (error) {
    logError('cards_repository_card_fetch_failed', {
      card_id: cardId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('Failed to fetch card')
  }

  if (!card) return null

  try {
    const { valuationByProgram, ratesByCard } = await loadCardMetadata([card])
    return buildCardWithRates(card, valuationByProgram.get(card.program_id), ratesByCard.get(cardId))
  } catch (error) {
    logError('cards_repository_card_metadata_fetch_failed', {
      card_id: cardId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('Failed to fetch card metadata')
  }
}
