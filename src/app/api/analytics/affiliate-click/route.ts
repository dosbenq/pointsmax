import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { and, eq } from 'drizzle-orm'
import { getSessionUser, getUserRowId } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { affiliateClicks, cards, creators } from '@/lib/db/schema'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'
import { badRequest } from '@/lib/error-utils'
import { getSafeExternalUrl } from '@/lib/card-surfaces'

const MAX_BODY_BYTES = 8_000
const CREATOR_REF_COOKIE = 'pm_creator_ref'

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

function normalizeCreatorSlug(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  return /^[a-z0-9-]{2,64}$/.test(trimmed) ? trimmed : null
}

async function insertWithRetry(
  payload: {
    card_id: string
    user_id: string | null
    source_page: string
    creator_slug: string | null
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
        creatorSlug: payload.creator_slug,
        rank: payload.rank,
        region: payload.region,
        recommendationMode: payload.recommendation_mode,
        programId: payload.program_id,
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

  const db = getDb()
  const creatorSlug = normalizeCreatorSlug(req.cookies.get(CREATOR_REF_COOKIE)?.value ?? null)
  let resolvedCreatorSlug: string | null = null
  if (creatorSlug) {
    const [creator] = await db
      .select({ slug: creators.slug })
      .from(creators)
      .where(eq(creators.slug, creatorSlug))
      .limit(1)
    resolvedCreatorSlug = creator?.slug ?? null
  }

  let card: { id: string; apply_url: string | null } | undefined
  let cardError: string | null = null
  try {
    ;[card] = await db
      .select({ id: cards.id, apply_url: cards.applyUrl })
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.isActive, true)))
      .limit(1)
  } catch (error) {
    // e.g. card_id is not a UUID
    cardError = error instanceof Error ? error.message : String(error)
  }

  if (!card) {
    logWarn('affiliate_click_unknown_card', {
      requestId,
      card_id: cardId,
      error: cardError,
    })
    return badRequest('Unknown card_id')
  }

  const redirectUrl = getSafeExternalUrl(card.apply_url)
  if (!redirectUrl) {
    return badRequest('No valid apply_url configured for card')
  }

  let userId: string | null = null
  try {
    const user = await getSessionUser(req.headers)
    if (user) userId = await getUserRowId(user.id)
  } catch {
    userId = null
  }

  const insertResult = await insertWithRetry({
    card_id: cardId,
    user_id: userId,
    source_page: sourcePage,
    creator_slug: resolvedCreatorSlug,
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
      creator_slug: resolvedCreatorSlug,
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
    creator_slug: resolvedCreatorSlug,
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
