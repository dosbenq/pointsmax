// ============================================================
// Cards Repository — cards are reference data served from the catalog
// ============================================================

import { getCatalogCardById, getCatalogCardEarningRates, getCatalogCards, getCatalogLatestValuations } from '@/lib/catalog'
import type { CardWithRates, SpendCategory } from '@/types/database'
import { resolveCppCents } from '@/lib/cpp-fallback'

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
  cpp_cents: number
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

export async function getActiveCards(geography: Geography): Promise<CardWithRates[]> {
  const cards = getCatalogCards({ geography }).sort((left, right) => left.display_order - right.display_order) as unknown as CardRow[]
  if (cards.length === 0) return []

  const valuationByProgram = new Map(
    getCatalogLatestValuations([...new Set(cards.map((card) => card.program_id))]).map((row) => [row.program_id, row as ValuationRow]),
  )
  const ratesByCard = buildRatesByCard(getCatalogCardEarningRates(cards.map((card) => card.id)))

  return cards.map((card) => buildCardWithRates(card, valuationByProgram.get(card.program_id), ratesByCard.get(card.id)))
}

export async function getCardById(cardId: string): Promise<CardWithRates | null> {
  const card = getCatalogCardById(cardId)
  if (!card || !card.is_active) return null

  const valuation = getCatalogLatestValuations([card.program_id])[0] as ValuationRow | undefined
  const ratesByCard = buildRatesByCard(getCatalogCardEarningRates([cardId]))

  return buildCardWithRates(card as unknown as CardRow, valuation, ratesByCard.get(cardId))
}
