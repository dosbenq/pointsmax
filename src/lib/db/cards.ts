// ============================================================
// Cards Repository — DB-backed card catalog access
// ============================================================

import { createPublicClient } from '@/lib/supabase'
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
  const db = createPublicClient()

  let cardsRes = await db
    .from('cards')
    .select('*')
    .eq('is_active', true)
    .eq('geography', geography)
    .order('display_order')

  const cardsTableMissingGeography = cardsRes.error?.code === '42703'
  if (cardsTableMissingGeography) {
    cardsRes = await db
      .from('cards')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
  }

  if (cardsRes.error) {
    logError('cards_repository_fetch_failed', {
      geography,
      cards_error: cardsRes.error.message,
      valuations_error: null,
      rates_error: null,
    })
    throw new Error('Failed to fetch cards')
  }

  const cardsRaw = (cardsRes.data ?? []) as unknown as CardRow[]
  const cards = cardsTableMissingGeography
    ? (geography === 'US' ? cardsRaw : [])
    : cardsRaw

  if (cards.length === 0) return []

  const activeCardIds = cards.map((card) => card.id)
  const activeProgramIds = [...new Set(cards.map((card) => card.program_id))]

  const [valuationsRes, ratesRes] = await Promise.all([
    db
      .from('latest_valuations')
      .select('program_id, cpp_cents, program_name, program_slug, program_type')
      .in('program_id', activeProgramIds),
    db
      .from('card_earning_rates')
      .select('*')
      .in('card_id', activeCardIds),
  ])

  if (valuationsRes.error || ratesRes.error) {
    logError('cards_repository_fetch_failed', {
      geography,
      cards_error: null,
      valuations_error: valuationsRes.error?.message ?? null,
      rates_error: ratesRes.error?.message ?? null,
    })
    throw new Error('Failed to fetch card metadata')
  }

  const valuationByProgram = new Map(
    (((valuationsRes.data ?? []) as unknown as ValuationRow[]).map((row) => [row.program_id, row])),
  )
  const ratesByCard = buildRatesByCard((ratesRes.data ?? []) as unknown as RateRow[])

  return cards.map((card) => buildCardWithRates(card, valuationByProgram.get(card.program_id), ratesByCard.get(card.id)))
}

export async function getCardById(cardId: string): Promise<CardWithRates | null> {
  const db = createPublicClient()

  const cardRes = await db
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .eq('is_active', true)
    .single()

  if (cardRes.error) {
    logError('cards_repository_card_fetch_failed', {
      card_id: cardId,
      error: cardRes.error.message,
    })
    throw new Error('Failed to fetch card')
  }

  if (!cardRes.data) return null

  const card = cardRes.data as unknown as CardRow
  const [valuationsRes, ratesRes] = await Promise.all([
    db
      .from('latest_valuations')
      .select('program_id, cpp_cents, program_name, program_slug, program_type')
      .eq('program_id', card.program_id),
    db
      .from('card_earning_rates')
      .select('*')
      .eq('card_id', cardId),
  ])

  if (valuationsRes.error || ratesRes.error) {
    logError('cards_repository_card_metadata_fetch_failed', {
      card_id: cardId,
      valuations_error: valuationsRes.error?.message ?? null,
      rates_error: ratesRes.error?.message ?? null,
    })
    throw new Error('Failed to fetch card metadata')
  }

  const valuation = ((valuationsRes.data ?? []) as unknown as ValuationRow[])[0]
  const ratesByCard = buildRatesByCard((ratesRes.data ?? []) as unknown as RateRow[])

  return buildCardWithRates(card, valuation, ratesByCard.get(cardId))
}
