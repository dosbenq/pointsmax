import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getAuthContext } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { bookingGuideSessions, bookingGuideSteps } from '@/lib/db/schema'
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

  const auth = await getAuthContext()
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

  let session: BookingGuideSessionRow | undefined
  let currentStep: { id: string; step_index: number } | undefined
  try {
    const [sessionData] = await getDb()
      .select(columnsOf(bookingGuideSessions))
      .from(bookingGuideSessions)
      .where(and(eq(bookingGuideSessions.id, sessionId), eq(bookingGuideSessions.userId, auth.profileId)))
      .limit(1)
    session = sessionData as unknown as BookingGuideSessionRow | undefined
    if (session && session.status === 'active') {
      ;[currentStep] = await getDb()
        .select({ id: bookingGuideSteps.id, step_index: bookingGuideSteps.stepIndex })
        .from(bookingGuideSteps)
        .where(and(eq(bookingGuideSteps.sessionId, sessionId), eq(bookingGuideSteps.status, 'current')))
        .limit(1)
    }
  } catch {
    return NextResponse.json({ error: 'Failed to load booking guide session' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: `Session is ${session.status}` }, { status: 409 })
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
        step_index: currentStep.step_index ?? session.current_step_index,
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
