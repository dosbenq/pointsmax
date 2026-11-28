import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getAuthContext } from '@/lib/auth'
import { UUID_RE } from '@/lib/auth-guard'
import { getDb } from '@/lib/db/client'
import { affiliateClicks } from '@/lib/db/schema'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'
import { badRequest } from '@/lib/error-utils'
import { getSafeExternalUrl } from '@/lib/card-surfaces'
import { getCatalogCardById } from '@/lib/catalog'

const MAX_BODY_BYTES = 8_000

type Payload = {
  card_id?: unknown
  program_id?: unknown
  source_page?: unknown
  rank?: unknown
  region?: unknown
  recommendation_mode?: unknown
}


function normalizeSourcePage(value: unknown): string {
  if (typeof value !== 'string') return 'unknown'
  const trimmed = value.trim()
  if (!trimmed) return 'unknown'
  return trimmed.slice(0, 80)
}

function normalizeRegion(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  return trimmed.slice(0, 10)
}

function normalizeRank(value: unknown): number | null {
  if (typeof value === 'number') return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? null : parsed
  }
  return null
}

async function insertWithRetry(
  payload: {
    card_id: string
    user_id: string | null
    source_page: string
    rank: number | null
    region: string | null
    recommendation_mode: string | null
    program_id: string | null
  },
  maxAttempts = 3,
) {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await getDb().insert(affiliateClicks).values({
        cardId: payload.card_id,
        userId: payload.user_id,
        sourcePage: payload.source_page,
        rank: payload.rank,
        region: payload.region,
        recommendationMode: payload.recommendation_mode,
        // program_id comes from the browser; keep it only if it is a real id.
        programId: payload.program_id && UUID_RE.test(payload.program_id) ? payload.program_id : null,
      })
      return { ok: true as const }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt))
    }
  }
  return {
    ok: false as const,
    error: lastError?.message ?? 'DB insert failed after retries',
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'affiliate_click_ip',
    maxRequests: 120,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  let body: Payload
  try {
    body = (await req.json()) as Payload
  } catch {
    return badRequest('Invalid JSON')
  }

  const cardId = typeof body.card_id === 'string' ? body.card_id.trim() : ''
  const sourcePage = normalizeSourcePage(body.source_page)
  const rank = normalizeRank(body.rank)
  const region = normalizeRegion(body.region)
  const recommendationMode = typeof body.recommendation_mode === 'string' ? body.recommendation_mode : null
  const programId = typeof body.program_id === 'string' ? body.program_id : null
  return trackAndReturn(req, requestId, cardId, sourcePage, false, rank, region, recommendationMode, programId)
}

async function trackAndReturn(
  req: NextRequest,
  requestId: string,
  cardId: string,
  sourcePage: string,
  redirect: boolean,
  rank: number | null = null,
  region: string | null = null,
  recommendationMode: string | null = null,
  programId: string | null = null,
) {
  if (!cardId) {
    return badRequest('card_id is required')
  }

  const catalogCard = getCatalogCardById(cardId)
  const card = catalogCard?.is_active ? catalogCard : null
  if (!card) {
    logWarn('affiliate_click_unknown_card', { requestId, card_id: cardId })
    return badRequest('Unknown card_id')
  }

  const redirectUrl = getSafeExternalUrl(card.apply_url)
  if (!redirectUrl) {
    return badRequest('No valid apply_url configured for card')
  }

  // Attribution to a signed-in user is best-effort; the click is tracked either way.
  let userId: string | null = null
  try {
    userId = (await getAuthContext()).profileId
  } catch {
    userId = null
  }

  const insertResult = await insertWithRetry({
    card_id: cardId,
    user_id: userId,
    source_page: sourcePage,
    rank,
    region,
    recommendation_mode: recommendationMode,
    program_id: programId,
  })
  if (!insertResult.ok) {
    logError('affiliate_click_insert_failed', {
      requestId,
      card_id: cardId,
      error: insertResult.error,
      attempts: 3,
      user_id: userId,
      source_page: sourcePage,
      rank,
      region,
    })
    if (redirect) {
      return NextResponse.redirect(redirectUrl)
    }
    return NextResponse.json({
      ok: true,
      tracked: false,
      redirect_url: redirectUrl,
    })
  }

  logInfo('affiliate_click_tracked', {
    requestId,
    card_id: cardId,
    source_page: sourcePage,
    user_id: userId,
    rank,
    region,
  })

  if (redirect) {
    return NextResponse.redirect(redirectUrl)
  }
  return NextResponse.json({ ok: true, tracked: true, redirect_url: redirectUrl })
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'affiliate_click_ip',
    maxRequests: 120,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const cardId = req.nextUrl.searchParams.get('card_id')?.trim() ?? ''
  const sourcePage = normalizeSourcePage(req.nextUrl.searchParams.get('source_page'))
  const rank = normalizeRank(req.nextUrl.searchParams.get('rank'))
  const region = normalizeRegion(req.nextUrl.searchParams.get('region'))
  return trackAndReturn(req, requestId, cardId, sourcePage, true, rank, region)
}
