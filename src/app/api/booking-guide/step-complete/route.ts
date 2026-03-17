import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { inngest } from '@/lib/inngest/client'
import { getRequestId, logError, logWarn } from '@/lib/logger'
import type { BookingGuideSessionRow } from '@/lib/booking-guide-store'

const MAX_BODY_BYTES = 8_000
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Body = {
  session_id?: unknown
  note?: unknown
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

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'booking_guide_step_complete_ip',
    maxRequests: 60,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const auth = await getAuthenticatedUser()
  if (!auth.authUserId || !auth.profileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : ''
  const note = typeof body.note === 'string'
    ? body.note.trim().slice(0, 280)
    : ''

  if (!SESSION_ID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'session_id is required and must be a valid UUID' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
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

  const session = sessionData as unknown as BookingGuideSessionRow
  if (session.status !== 'active') {
    return NextResponse.json({ error: `Session is ${session.status}` }, { status: 409 })
  }

  const { data: currentStep, error: stepError } = await supabase
    .from('booking_guide_steps')
    .select('id, step_index')
    .eq('session_id', sessionId)
    .eq('status', 'current')
    .maybeSingle()

  if (stepError) {
    return NextResponse.json({ error: 'Failed to load current step' }, { status: 500 })
  }
  if (!currentStep) {
    return NextResponse.json({ error: 'No current step is available for completion' }, { status: 409 })
  }

  if (!process.env.INNGEST_EVENT_KEY?.trim() && process.env.NODE_ENV === 'production') {
    logWarn('booking_guide_step_complete_missing_event_key', { requestId, user_id: auth.profileId })
    return NextResponse.json(
      { error: 'Workflow is not configured. Missing INNGEST_EVENT_KEY.' },
      { status: 503 },
    )
  }

  try {
    const result = await inngest.send({
      name: 'booking.step_completed',
      data: {
        session_id: sessionId,
        user_id: auth.profileId,
        step_index: (currentStep as { step_index?: number }).step_index ?? session.current_step_index,
        note,
        completed_at: new Date().toISOString(),
      },
    })

    const eventIds = Array.isArray(result)
      ? result
        .map((item) => (item && typeof item === 'object' && 'id' in item ? String((item as { id?: unknown }).id ?? '') : ''))
        .filter(Boolean)
      : []

    return NextResponse.json({ ok: true, session_id: sessionId, event_ids: eventIds })
  } catch (error) {
    logError('booking_guide_step_complete_failed', {
      requestId,
      user_id: auth.profileId,
      session_id: sessionId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to submit completion event' }, { status: 500 })
  }
}
