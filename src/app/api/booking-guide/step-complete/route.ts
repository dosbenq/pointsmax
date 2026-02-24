import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { inngest } from '@/lib/inngest/client'
import { getRequestId, logError, logWarn } from '@/lib/logger'

const MAX_BODY_BYTES = 8_000

type Body = {
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

  const note = typeof body.note === 'string'
    ? body.note.trim().slice(0, 280)
    : ''

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
        user_id: auth.profileId,
        note,
        completed_at: new Date().toISOString(),
      },
    })

    const eventIds = Array.isArray(result)
      ? result
        .map((item) => (item && typeof item === 'object' && 'id' in item ? String((item as { id?: unknown }).id ?? '') : ''))
        .filter(Boolean)
      : []

    return NextResponse.json({ ok: true, event_ids: eventIds })
  } catch (error) {
    logError('booking_guide_step_complete_failed', {
      requestId,
      user_id: auth.profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to submit completion event' }, { status: 500 })
  }
}
