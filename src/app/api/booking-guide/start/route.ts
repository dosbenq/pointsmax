import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq } from 'drizzle-orm'
import { getAuthContext } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { bookingGuideSessions, bookingGuideSteps } from '@/lib/db/schema'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { inngest } from '@/lib/inngest/client'
import { getRequestId, logError, logWarn } from '@/lib/logger'
import {
  sanitizeBookingGuideContext,
  type BookingGuideContext,
} from '@/lib/booking-guide-context'
import {
  getCurrentBookingGuideStep,
  type BookingGuideSessionRow,
  type BookingGuideStepRow,
} from '@/lib/booking-guide-store'

const MAX_BODY_BYTES = 8_000
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Body = {
  redemption_label?: unknown
  booking_context?: unknown
}

function isSessionId(value: string): boolean {
  return SESSION_ID_RE.test(value)
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth.authUserId || !auth.profileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = (searchParams.get('session_id') ?? '').trim()
  const db = getDb()

  if (!sessionId) {
    try {
      const sessions = await db
        .select(columnsOf(bookingGuideSessions))
        .from(bookingGuideSessions)
        .where(eq(bookingGuideSessions.userId, auth.profileId))
        .orderBy(desc(bookingGuideSessions.createdAt))
        .limit(10)
      return NextResponse.json({ sessions })
    } catch {
      return NextResponse.json({ error: 'Failed to load booking guide sessions' }, { status: 500 })
    }
  }

  if (!isSessionId(sessionId)) {
    return NextResponse.json({ error: 'session_id must be a valid UUID' }, { status: 400 })
  }

  let sessionData: unknown
  let stepsData: unknown[]
  try {
    ;[sessionData] = await db
      .select(columnsOf(bookingGuideSessions))
      .from(bookingGuideSessions)
      .where(and(eq(bookingGuideSessions.id, sessionId), eq(bookingGuideSessions.userId, auth.profileId)))
      .limit(1)
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    stepsData = await db
      .select(columnsOf(bookingGuideSteps))
      .from(bookingGuideSteps)
      .where(eq(bookingGuideSteps.sessionId, sessionId))
      .orderBy(asc(bookingGuideSteps.stepIndex))
  } catch {
    return NextResponse.json({ error: 'Failed to load booking guide session' }, { status: 500 })
  }

  const session = sessionData as unknown as BookingGuideSessionRow
  const steps = stepsData as unknown as BookingGuideStepRow[]

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

  const auth = await getAuthContext()
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
  const bookingContext: BookingGuideContext | null = sanitizeBookingGuideContext(body.booking_context)

  // Check Inngest configuration FIRST, before creating a session
  if (!process.env.INNGEST_EVENT_KEY?.trim() && process.env.NODE_ENV === 'production') {
    logWarn('booking_guide_start_missing_event_key', { requestId, user_id: auth.profileId })
    return NextResponse.json(
      { error: 'Booking workflow service is not configured' },
      { status: 503 },
    )
  }

  let sessionData: unknown
  try {
    ;[sessionData] = await getDb()
      .insert(bookingGuideSessions)
      .values({
        userId: auth.profileId,
        redemptionLabel,
        status: 'pending',
        currentStepIndex: 0,
        totalSteps: 0,
      })
      .returning(columnsOf(bookingGuideSessions))
  } catch (error) {
    logError('booking_guide_session_create_failed', {
      requestId,
      user_id: auth.profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to create booking guide session' }, { status: 500 })
  }

  const session = sessionData as unknown as BookingGuideSessionRow

  try {
    const result = await inngest.send({
      name: 'booking.started',
      data: {
        session_id: session.id,
        user_id: auth.profileId,
        redemption_label: redemptionLabel,
        booking_context: bookingContext,
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
    await getDb()
      .update(bookingGuideSessions)
      .set({
        status: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(bookingGuideSessions.id, session.id))

    logError('booking_guide_start_failed', {
      requestId,
      user_id: auth.profileId,
      session_id: session.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to start workflow' }, { status: 500 })
  }
}
