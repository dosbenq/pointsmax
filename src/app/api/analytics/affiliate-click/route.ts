import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'
import { badRequest, internalError } from '@/lib/error-utils'

const MAX_BODY_BYTES = 8_000
const CREATOR_REF_COOKIE = 'pm_creator_ref'

type Payload = {
  card_id?: unknown
  program_id?: unknown
  source_page?: unknown
}

type CreatorSlugRow = { slug: string }
type CardRow = { id: string; apply_url: string | null }
type UserIdRow = { id: string }

function normalizeSourcePage(value: unknown): string {
  if (typeof value !== 'string') return 'unknown'
  const trimmed = value.trim()
  if (!trimmed) return 'unknown'
  return trimmed.slice(0, 80)
}

function normalizeCreatorSlug(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  return /^[a-z0-9-]{2,64}$/.test(trimmed) ? trimmed : null
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
  return trackAndReturn(req, requestId, cardId, sourcePage, false)
}

async function trackAndReturn(
  req: NextRequest,
  requestId: string,
  cardId: string,
  sourcePage: string,
  redirect: boolean,
) {
  if (!cardId) {
    return badRequest('card_id is required')
  }

  const db = createAdminClient()
  const creatorSlug = normalizeCreatorSlug(req.cookies.get(CREATOR_REF_COOKIE)?.value ?? null)
  let resolvedCreatorSlug: string | null = null
  if (creatorSlug) {
    const { data: creatorData } = await db
      .from('creators')
      .select('slug')
      .eq('slug', creatorSlug)
      .maybeSingle()
    const creator = (creatorData ?? null) as CreatorSlugRow | null
    resolvedCreatorSlug = creator?.slug ?? null
  }
  const { data: cardData, error: cardErr } = await db
    .from('cards')
    .select('id, apply_url')
    .eq('id', cardId)
    .eq('is_active', true)
    .single()
  const card = (cardData ?? null) as CardRow | null

  if (cardErr || !card) {
    logWarn('affiliate_click_unknown_card', {
      requestId,
      card_id: cardId,
      error: cardErr?.message ?? null,
    })
    return badRequest('Unknown card_id')
  }

  const redirectUrl = typeof card.apply_url === 'string' ? card.apply_url.trim() : ''
  if (!redirectUrl) {
    return badRequest('No apply_url configured for card')
  }

  let userId: string | null = null
  try {
    const supabase = await createSupabaseServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const authUserId = authData.user?.id ?? null
    if (authUserId) {
      const { data: userRowData } = await db
        .from('users')
        .select('id')
        .eq('auth_id', authUserId)
        .single()
      const userRow = (userRowData ?? null) as UserIdRow | null
      userId = userRow?.id ?? null
    }
  } catch {
    userId = null
  }

  // Retry logic for DB writes (Q7) - up to 3 attempts with exponential backoff
  let insertErr: Error | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await db.from('affiliate_clicks').insert({
      card_id: cardId,
      user_id: userId,
      source_page: sourcePage,
      creator_slug: resolvedCreatorSlug,
    } as never)
    if (!result.error) {
      insertErr = null
      break
    }
    insertErr = result.error
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 100 * attempt)) // 100ms, 200ms
    }
  }

  if (insertErr) {
    logError('affiliate_click_insert_failed', {
      requestId,
      card_id: cardId,
      error: insertErr.message,
      attempts: 3,
    })
    // Fire-and-forget: still return success to user, but log the error
    logWarn('affiliate_click_logged_but_not_persisted', {
      requestId,
      card_id: cardId,
      user_id: userId,
      source_page: sourcePage,
      creator_slug: resolvedCreatorSlug,
    })
  }

  logInfo('affiliate_click_tracked', {
    requestId,
    card_id: cardId,
    source_page: sourcePage,
    user_id: userId,
    creator_slug: resolvedCreatorSlug,
  })

  if (redirect) {
    return NextResponse.redirect(redirectUrl)
  }
  return NextResponse.json({ ok: true, redirect_url: redirectUrl })
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
  return trackAndReturn(req, requestId, cardId, sourcePage, true)
}
