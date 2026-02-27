// ============================================================
// GET /api/cards
// Returns all active cards with earning rates and valuations
// Reused by Earning Calculator and Card Recommender
// ============================================================

import { NextResponse } from 'next/server'
import { getActiveCards, normalizeGeography } from '@/lib/db/cards'
import { logError } from '@/lib/logger'
import { enforceRateLimit } from '@/lib/api-security'
import { internalError } from '@/lib/error-utils'

export async function GET(request: Request) {
  // Rate limit: 60 requests per minute per IP
  const rateLimitError = await enforceRateLimit(request, {
    namespace: 'cards_ip',
    maxRequests: 60,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const geography = normalizeGeography(new URL(request.url).searchParams.get('geography'))

  try {
    const cards = await getActiveCards(geography)

    return NextResponse.json(
      { cards, geography },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (error) {
    logError('cards_api_error', {
      geography,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return internalError('Failed to load cards')
  }
}
