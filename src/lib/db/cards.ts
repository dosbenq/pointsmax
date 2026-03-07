// ============================================================
// Cards Repository — Sprint 17
// All database access for card-related queries
// Replaces direct Supabase calls in API routes
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
  currency?: unknown
  earn_unit?: unknown
  geography?: unknown
  apply_url?: unknown
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

/**
 * Normalize geography string to valid Geography type
 */
export function normalizeGeography(value: string | null): Geography {
  if (!value) return 'US'
  return value.toUpperCase() === 'IN' ? 'IN' : 'US'
}

/**
 * Normalize CPP cents for India cards (handles paise vs cents conversion)
 * Backward compatibility: old India seeds used rupees-per-point, while the app expects minor units.
 */
export function normalizeCardCppCents(cppCents: number, currency: 'USD' | 'INR'): number {
  if (currency === 'INR' && cppCents <= 5) return cppCents * 100
  return cppCents
}

/**
 * Fetch all active cards with earning rates and valuations for a geography
 */
export async function getActiveCards(geography: Geography): Promise<CardWithRates[]> {
  const db = createPublicClient()

  let cardsRes = await db
    .from('cards')
    .select('*')
    .eq('is_active', true)
    .eq('geography', geography)
    .order('display_order')

  // Backward compatibility: if geography column doesn't exist yet
  const cardsTableMissingGeography = cardsRes.error?.code === '42703'
  if (cardsTableMissingGeography) {
    cardsRes = await db
      .from('cards')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
  }

  const valuationsRes = await db
    .from('latest_valuations')
    .select('program_id, cpp_cents, program_name, program_slug, program_type')

  if (cardsRes.error || valuationsRes.error) {
    logError('cards_repository_fetch_failed', {
      geography,
      cards_error: cardsRes.error?.message ?? null,
      valuations_error: valuationsRes.error?.message ?? null,
    })
    throw new Error('Failed to fetch cards data')
  }

  const cardsRaw = (cardsRes.data ?? []) as unknown as CardRow[]
  const cards = cardsTableMissingGeography
    ? geography === 'US' ? cardsRaw : []
    : cardsRaw

  const valuations = (valuationsRes.data ?? []) as unknown as ValuationRow[]
  const activeCardIds = cards.map(card => card.id)

  let rates: RateRow[] = []
  if (activeCardIds.length > 0) {
    const ratesRes = await db
      .from('card_earning_rates')
      .select('*')
      .in('card_id', activeCardIds)

    if (ratesRes.error) {
      logError('cards_repository_rates_fetch_failed', { geography, error: ratesRes.error.message })
      throw new Error('Failed to fetch card rates')
    }

    rates = (ratesRes.data ?? []) as unknown as RateRow[]
  }

  // Build lookup maps
  const valuationByProgram = new Map(valuations.map(v => [v.program_id, v]))
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

  const result: CardWithRates[] = cards.map(card => {
    const val = valuationByProgram.get(card.program_id)
    const currency = card.currency === 'INR' ? 'INR' : 'USD'
    const resolvedCppCents = resolveCppCents(val?.cpp_cents, val?.program_type)
    const normalizedCppCents = normalizeCardCppCents(resolvedCppCents, currency)

    const cardRates = ratesByCard.get(card.id) ?? { ...defaultRates }
    if (!Number.isFinite(cardRates.shopping) || cardRates.shopping <= 0) {
      cardRates.shopping = cardRates.other
    }

    return {
      ...card,
      currency,
      earn_unit: typeof card.earn_unit === 'string'
        ? card.earn_unit
        : (currency === 'INR' ? '100_inr' : '1_dollar'),
      geography: card.geography === 'IN' ? 'IN' : 'US',
      apply_url: typeof card.apply_url === 'string' ? card.apply_url : null,
      program_name: val?.program_name ?? 'Unknown',
      program_slug: val?.program_slug ?? '',
      cpp_cents: normalizedCppCents,
      earning_rates: cardRates,
    }
  })

  return result
}

/**
 * Fetch a single card by ID
 */
export async function getCardById(cardId: string): Promise<CardWithRates | null> {
  const db = createPublicClient()

  const cardRes = await db
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .eq('is_active', true)
    .single()

  if (cardRes.error || !cardRes.data) {
    return null
  }

  const card = cardRes.data as unknown as CardRow
  const geography = normalizeGeography(card.geography as string)

  const [valuationsRes, ratesRes] = await Promise.all([
    db.from('latest_valuations').select('program_id, cpp_cents, program_name, program_slug, program_type'),
    db.from('card_earning_rates').select('*').eq('card_id', cardId),
  ])

  if (valuationsRes.error) {
    logError('cards_repository_valuation_fetch_failed', { card_id: cardId, error: valuationsRes.error.message })
    throw new Error('Failed to fetch card valuation')
  }

  const valuations = (valuationsRes.data ?? []) as unknown as ValuationRow[]
  const rates = (ratesRes.data ?? []) as unknown as RateRow[]
  const val = valuations.find(v => v.program_id === card.program_id)

  const currency = card.currency === 'INR' ? 'INR' : 'USD'
  const resolvedCppCents = resolveCppCents(val?.cpp_cents, val?.program_type)
  const normalizedCppCents = normalizeCardCppCents(resolvedCppCents, currency)

  const cardRates: Record<SpendCategory, number> = { ...defaultRates }
  for (const rate of rates) {
    const category = rate.category as SpendCategory
    if (category in cardRates) {
      cardRates[category] = Number(rate.earn_multiplier)
    }
  }
  if (!Number.isFinite(cardRates.shopping) || cardRates.shopping <= 0) {
    cardRates.shopping = cardRates.other
  }

  return {
    ...card,
    currency,
    earn_unit: typeof card.earn_unit === 'string'
      ? card.earn_unit
      : (currency === 'INR' ? '100_inr' : '1_dollar'),
    geography,
    apply_url: typeof card.apply_url === 'string' ? card.apply_url : null,
    program_name: val?.program_name ?? 'Unknown',
    program_slug: val?.program_slug ?? '',
    cpp_cents: normalizedCppCents,
    earning_rates: cardRates,
  }
}
