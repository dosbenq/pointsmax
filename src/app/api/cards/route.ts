// ============================================================
// GET /api/cards
// Returns all active cards with earning rates and valuations
// Reused by Earning Calculator and Card Recommender
// ============================================================

import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase'
import type { CardWithRates, SpendCategory } from '@/types/database'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { logError } from '@/lib/logger'

export async function GET() {
  const db = createPublicClient()

  const [cardsRes, valuationsRes] = await Promise.all([
    db.from('cards').select('*').eq('is_active', true).order('display_order'),
    db.from('latest_valuations').select('program_id, cpp_cents, program_name, program_slug, program_type'),
  ])

  if (cardsRes.error || valuationsRes.error) {
    logError('cards_api_fetch_failed', {
      cards_error: cardsRes.error?.message ?? null,
      valuations_error: valuationsRes.error?.message ?? null,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const cards = cardsRes.data ?? []
  const valuations = valuationsRes.data ?? []
  const activeCardIds = cards.map(card => card.id)
  let rates: Array<{
    card_id: string
    category: string
    earn_multiplier: number
  }> = []
  if (activeCardIds.length > 0) {
    const ratesRes = await db
      .from('card_earning_rates')
      .select('*')
      .in('card_id', activeCardIds)

    if (ratesRes.error) {
      logError('cards_api_rates_fetch_failed', { error: ratesRes.error.message })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    rates = ratesRes.data ?? []
  }

  // Build lookup maps
  const valuationByProgram = new Map(valuations.map(v => [v.program_id, v]))
  const ratesByCard = new Map<string, Record<SpendCategory, number>>()

  for (const rate of rates) {
    if (!ratesByCard.has(rate.card_id)) {
      ratesByCard.set(rate.card_id, {
        dining: 1, groceries: 1, travel: 1, gas: 1, streaming: 1, other: 1,
      })
    }
    ratesByCard.get(rate.card_id)![rate.category as SpendCategory] = Number(rate.earn_multiplier)
  }

  const result: CardWithRates[] = cards.map(card => {
    const val = valuationByProgram.get(card.program_id)
    return {
      ...card,
      program_name: val?.program_name ?? 'Unknown',
      program_slug: val?.program_slug ?? '',
      cpp_cents: resolveCppCents(val?.cpp_cents, val?.program_type),
      earning_rates: ratesByCard.get(card.id) ?? {
        dining: 1, groceries: 1, travel: 1, gas: 1, streaming: 1, other: 1,
      },
    }
  })

  return NextResponse.json(
    { cards: result },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  )
}
