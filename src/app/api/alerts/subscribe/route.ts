// ============================================================
// POST /api/alerts/subscribe
// Subscribe or update alert subscription for transfer bonuses
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 16_000
type UserIdRow = { id: string }
type ExistingSubscriptionRow = { id: string; user_id: string | null }

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
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      authEmail = session.user.email?.trim().toLowerCase() ?? null

      // Look up internal user record
      const db = createAdminClient()
      const { data: userRowData } = await db
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single()
      const userRow = (userRowData ?? null) as UserIdRow | null
      user_id = userRow?.id ?? null
    }
  } catch {
    // non-blocking
  }

  const db = createAdminClient()
  const { data: existingData } = await db
    .from('alert_subscriptions')
    .select('id, user_id')
    .eq('email', normalizedEmail)
    .maybeSingle()
  const existing = (existingData ?? null) as ExistingSubscriptionRow | null

  // Authenticated users can only mutate their own email subscription.
  if (user_id) {
    if (!authEmail || authEmail !== normalizedEmail) {
      return NextResponse.json(
        { error: 'When signed in, email must match your account email' },
        { status: 403 },
      )
    }

    const { error } = await db
      .from('alert_subscriptions')
      .upsert(
        { email: normalizedEmail, user_id, program_ids: cleanedProgramIds, is_active: true } as never,
        { onConflict: 'email' },
      )

    if (error) {
      logError('alerts_subscribe_upsert_failed', { requestId, error: error.message })
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

  const { error } = await db
    .from('alert_subscriptions')
    .insert({ email: normalizedEmail, user_id: null, program_ids: cleanedProgramIds, is_active: true } as never)

  if (error) {
    logError('alerts_subscribe_insert_failed', { requestId, error: error.message })
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
