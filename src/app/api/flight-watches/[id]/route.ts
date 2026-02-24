import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logWarn } from '@/lib/logger'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CABINS = new Set(['economy', 'premium_economy', 'business', 'first'])
const MAX_BODY_BYTES = 10_000
const MAX_SPAN_DAYS = 45

type UpdateWatchPayload = {
  origin?: unknown
  destination?: unknown
  cabin?: unknown
  start_date?: unknown
  end_date?: unknown
  max_points?: unknown
  is_active?: unknown
}

async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, authUserId: null, userId: null }

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  return { supabase, authUserId: user.id, userId: userRow?.id ?? null }
}

function parseIsoDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!DATE_RE.test(value)) return null
  const ms = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
  return value
}

function parseMaxPoints(raw: unknown): number | null | 'invalid' {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0 || value > 100_000_000) return 'invalid'
  return value
}

function validateDateRange(startDate: string, endDate: string): string | null {
  if (endDate < startDate) return 'end_date must be on or after start_date'
  const startMs = Date.parse(`${startDate}T00:00:00Z`)
  const endMs = Date.parse(`${endDate}T00:00:00Z`)
  const spanDays = Math.floor((endMs - startMs) / 86400000) + 1
  if (spanDays > MAX_SPAN_DAYS) {
    return `Date range too wide. Max ${MAX_SPAN_DAYS} days.`
  }
  return null
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req)
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'flight_watches_update_ip',
    maxRequests: 30,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('flight_watches_update_rate_limited', { requestId })
    return rateLimitError
  }

  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid watch id' }, { status: 400 })
  }

  const auth = await getAuthenticatedContext()
  if (!auth.authUserId || !auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing, error: existingErr } = await auth.supabase
    .from('flight_watches')
    .select('id, origin, destination, cabin, start_date, end_date, max_points, is_active')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single()

  if (existingErr || !existing) {
    return NextResponse.json({ error: 'Watch not found' }, { status: 404 })
  }

  let body: UpdateWatchPayload
  try {
    body = (await req.json()) as UpdateWatchPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (body.origin !== undefined) {
    const origin = typeof body.origin === 'string' ? body.origin.trim().toUpperCase() : ''
    if (!/^[A-Z]{3}$/.test(origin)) {
      return NextResponse.json({ error: 'origin must be a valid IATA code' }, { status: 400 })
    }
    updates.origin = origin
  }
  if (body.destination !== undefined) {
    const destination = typeof body.destination === 'string' ? body.destination.trim().toUpperCase() : ''
    if (!/^[A-Z]{3}$/.test(destination)) {
      return NextResponse.json({ error: 'destination must be a valid IATA code' }, { status: 400 })
    }
    updates.destination = destination
  }
  if (body.cabin !== undefined) {
    const cabin = typeof body.cabin === 'string' ? body.cabin.trim() : ''
    if (!CABINS.has(cabin)) {
      return NextResponse.json({ error: 'cabin must be one of economy, premium_economy, business, first' }, { status: 400 })
    }
    updates.cabin = cabin
  }
  if (body.start_date !== undefined) {
    const startDate = parseIsoDate(body.start_date)
    if (!startDate) {
      return NextResponse.json({ error: 'start_date must be YYYY-MM-DD' }, { status: 400 })
    }
    updates.start_date = startDate
  }
  if (body.end_date !== undefined) {
    const endDate = parseIsoDate(body.end_date)
    if (!endDate) {
      return NextResponse.json({ error: 'end_date must be YYYY-MM-DD' }, { status: 400 })
    }
    updates.end_date = endDate
  }
  if (body.max_points !== undefined) {
    const maxPoints = parseMaxPoints(body.max_points)
    if (maxPoints === 'invalid') {
      return NextResponse.json({ error: 'max_points must be a positive integer' }, { status: 400 })
    }
    updates.max_points = maxPoints
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
    }
    updates.is_active = body.is_active
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
  }

  const existingStartDate = parseIsoDate((existing as { start_date?: unknown }).start_date)
  const existingEndDate = parseIsoDate((existing as { end_date?: unknown }).end_date)
  if (!existingStartDate || !existingEndDate) {
    logError('flight_watches_update_invalid_existing_dates', { requestId, watch_id: id, user_id: auth.userId })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const startDate = (updates.start_date as string | undefined) ?? existingStartDate
  const endDate = (updates.end_date as string | undefined) ?? existingEndDate
  const dateRangeError = validateDateRange(startDate, endDate)
  if (dateRangeError) {
    return NextResponse.json({ error: dateRangeError }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('flight_watches')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id, origin, destination, cabin, start_date, end_date, max_points, is_active, last_checked_at, created_at')
    .single()

  if (error) {
    logError('flight_watches_update_failed', {
      requestId,
      watch_id: id,
      user_id: auth.userId,
      error: error.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, watch: data })
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req)
  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid watch id' }, { status: 400 })
  }

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'flight_watches_delete_ip',
    maxRequests: 40,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('flight_watches_delete_rate_limited', { requestId })
    return rateLimitError
  }

  const auth = await getAuthenticatedContext()
  if (!auth.authUserId || !auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await auth.supabase
    .from('flight_watches')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId)

  if (error) {
    logError('flight_watches_delete_failed', {
      requestId,
      watch_id: id,
      user_id: auth.userId,
      error: error.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
