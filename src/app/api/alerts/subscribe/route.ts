// ============================================================
// POST /api/alerts/subscribe
// Subscribe or update alert subscription for transfer bonuses
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSessionUser, getUserRowId } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { alertSubscriptions } from '@/lib/db/schema'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 16_000

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)

  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) {
    logWarn('alerts_subscribe_payload_too_large', { requestId })
    return sizeError
  }

  const ipRateLimitError = await enforceRateLimit(req, {
    namespace: 'alerts_subscribe_ip',
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  })
  if (ipRateLimitError) {
    logWarn('alerts_subscribe_rate_limited_ip', { requestId })
    return ipRateLimitError
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, program_ids } = body as { email?: string; program_ids?: string[] }
  const normalizedEmail = (email ?? '').trim().toLowerCase()
  const cleanedProgramIds = Array.isArray(program_ids)
    ? [...new Set(program_ids.filter((id): id is string => typeof id === 'string').map(id => id.trim()))]
    : []

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (cleanedProgramIds.length === 0) {
    return NextResponse.json({ error: 'At least one program_id is required' }, { status: 400 })
  }
  if (!cleanedProgramIds.every(id => UUID_RE.test(id))) {
    return NextResponse.json({ error: 'program_ids must be valid UUIDs' }, { status: 400 })
  }

  const emailRateLimitError = await enforceRateLimit(
    req,
    {
      namespace: 'alerts_subscribe_email',
      maxRequests: 5,
      windowMs: 30 * 60 * 1000,
    },
    `email:${normalizedEmail}`,
  )
  if (emailRateLimitError) {
    logWarn('alerts_subscribe_rate_limited_email', { requestId, email: normalizedEmail })
    return emailRateLimitError
  }

  // Try to get logged-in user/session
  let user_id: string | null = null
  let authEmail: string | null = null
  try {
    const user = await getSessionUser(req.headers)
    if (user) {
      authEmail = user.email?.trim().toLowerCase() ?? null
      user_id = await getUserRowId(user.id)
    }
  } catch {
    // non-blocking
  }

  const db = getDb()
  const [existing] = await db
    .select({ id: alertSubscriptions.id, user_id: alertSubscriptions.userId })
    .from(alertSubscriptions)
    .where(eq(alertSubscriptions.email, normalizedEmail))
    .limit(1)

  // Authenticated users can only mutate their own email subscription.
  if (user_id) {
    if (!authEmail || authEmail !== normalizedEmail) {
      return NextResponse.json(
        { error: 'When signed in, email must match your account email' },
        { status: 403 },
      )
    }

    try {
      const values = { userId: user_id, programIds: cleanedProgramIds, isActive: true }
      await db
        .insert(alertSubscriptions)
        .values({ email: normalizedEmail, ...values })
        .onConflictDoUpdate({ target: alertSubscriptions.email, set: values })
    } catch (error) {
      logError('alerts_subscribe_upsert_failed', { requestId, error: error instanceof Error ? error.message : String(error) })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    logInfo('alerts_subscribe_updated', {
      requestId,
      mode: 'authenticated',
      email: normalizedEmail,
      program_count: cleanedProgramIds.length,
    })
    return NextResponse.json({ ok: true })
  }

  // Guests cannot overwrite existing subscriptions they don't control.
  if (existing) {
    return NextResponse.json(
      { error: 'Subscription already exists for this email. Sign in to update it.' },
      { status: 409 },
    )
  }

  try {
    await db
      .insert(alertSubscriptions)
      .values({ email: normalizedEmail, userId: null, programIds: cleanedProgramIds, isActive: true })
  } catch (error) {
    logError('alerts_subscribe_insert_failed', { requestId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  logInfo('alerts_subscribe_created', {
    requestId,
    mode: 'guest',
    email: normalizedEmail,
    program_count: cleanedProgramIds.length,
  })
  return NextResponse.json({ ok: true })
}
