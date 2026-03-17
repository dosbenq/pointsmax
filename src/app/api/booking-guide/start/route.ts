import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { inngest } from '@/lib/inngest/client'
import { getRequestId, logError, logWarn } from '@/lib/logger'
import {
  getCurrentBookingGuideStep,
  type BookingGuideSessionRow,
  type BookingGuideStepRow,
} from '@/lib/booking-guide-store'

const MAX_BODY_BYTES = 8_000
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Body = {
  redemption_label?: unknown
}

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { authUserId: null, profileId: null }

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  return { authUserId: user.id, profileId: userRow?.id ?? null }
}

function isSessionId(value: string): boolean {
  return SESSION_ID_RE.test(value)
}

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth.authUserId || !auth.profileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createSupabaseServerClient()
  const { searchParams } = new URL(req.url)
  const sessionId = (searchParams.get('session_id') ?? '').trim()

  if (!sessionId) {
    const { data, error } = await supabase
      .from('booking_guide_sessions')
      .select('id, redemption_label, status, current_step_index, total_steps, started_at, completed_at, last_error, created_at, updated_at')
      .eq('user_id', auth.profileId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: 'Failed to load booking guide sessions' }, { status: 500 })
    }

    return NextResponse.json({ sessions: data ?? [] })
  }

  if (!isSessionId(sessionId)) {
    return NextResponse.json({ error: 'session_id must be a valid UUID' }, { status: 400 })
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from('booking_guide_sessions')
    .select('id, user_id, redemption_label, status, current_step_index, total_steps, started_at, completed_at, last_error, created_at, updated_at')
    .eq('id', sessionId)
    .eq('user_id', auth.profileId)
    .maybeSingle()

  if (sessionError) {
    return NextResponse.json({ error: 'Failed to load booking guide session' }, { status: 500 })
  }
  if (!sessionData) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { data: stepsData, error: stepsError } = await supabase
    .from('booking_guide_steps')
    .select('id, session_id, step_index, title, status, completion_note, completed_at, created_at, updated_at')
    .eq('session_id', sessionId)
    .order('step_index', { ascending: true })

  if (stepsError) {
    return NextResponse.json({ error: 'Failed to load booking guide steps' }, { status: 500 })
  }

  const session = sessionData as unknown as BookingGuideSessionRow
  const steps = (stepsData ?? []) as unknown as BookingGuideStepRow[]

  return NextResponse.json({
    session,
    steps,
    current_step: getCurrentBookingGuideStep(session, steps),
  })
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'booking_guide_start_ip',
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const auth = await getAuthenticatedUser()
  if (!auth.authUserId || !auth.profileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const redemptionLabel = typeof body.redemption_label === 'string'
    ? body.redemption_label.trim().slice(0, 280)
    : ''
  if (!redemptionLabel) {
    return NextResponse.json({ error: 'redemption_label is required' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: sessionData, error: sessionError } = await supabase
    .from('booking_guide_sessions')
    .insert({
      user_id: auth.profileId,
      redemption_label: redemptionLabel,
      status: 'pending',
      current_step_index: 0,
      total_steps: 0,
    })
    .select('id, user_id, redemption_label, status, current_step_index, total_steps, started_at, completed_at, last_error, created_at, updated_at')
    .single()

  if (sessionError || !sessionData) {
    logError('booking_guide_session_create_failed', {
      requestId,
      user_id: auth.profileId,
      error: sessionError?.message ?? 'unknown',
    })
    return NextResponse.json({ error: 'Failed to create booking guide session' }, { status: 500 })
  }

  const session = sessionData as unknown as BookingGuideSessionRow

  if (!process.env.INNGEST_EVENT_KEY?.trim() && process.env.NODE_ENV === 'production') {
    logWarn('booking_guide_start_missing_event_key', { requestId, user_id: auth.profileId })
    return NextResponse.json(
      { error: 'Workflow is not configured. Missing INNGEST_EVENT_KEY.' },
      { status: 503 },
    )
  }

  try {
    const result = await inngest.send({
      name: 'booking.started',
      data: {
        session_id: session.id,
        user_id: auth.profileId,
        redemption_label: redemptionLabel,
        requested_at: new Date().toISOString(),
      },
    })

    const eventIds = Array.isArray(result)
      ? result
        .map((item) => (item && typeof item === 'object' && 'id' in item ? String((item as { id?: unknown }).id ?? '') : ''))
        .filter(Boolean)
      : []

    return NextResponse.json({ ok: true, session, event_ids: eventIds })
  } catch (error) {
    await supabase
      .from('booking_guide_sessions')
      .update({
        status: 'failed',
        last_error: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    logError('booking_guide_start_failed', {
      requestId,
      user_id: auth.profileId,
      session_id: session.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to start workflow' }, { status: 500 })
  }
}
