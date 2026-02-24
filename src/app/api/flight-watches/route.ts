import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logWarn } from '@/lib/logger'

const IATA_RE = /^[A-Z]{3}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CABINS = new Set(['economy', 'premium_economy', 'business', 'first'])
const MAX_BODY_BYTES = 10_000
const MAX_SPAN_DAYS = 45

type CreateWatchPayload = {
  origin?: unknown
  destination?: unknown
  cabin?: unknown
  start_date?: unknown
  end_date?: unknown
  max_points?: unknown
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

function parseMaxPoints(raw: unknown): number | null | 'invalid' {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0 || value > 100_000_000) return 'invalid'
  return value
}

function parseIsoDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!DATE_RE.test(value)) return null
  const ms = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
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

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const context = await getAuthenticatedContext()
  if (!context.authUserId || !context.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await context.supabase
    .from('flight_watches')
    .select('id, origin, destination, cabin, start_date, end_date, max_points, is_active, last_checked_at, created_at')
    .eq('user_id', context.userId)
    .order('created_at', { ascending: false })

  if (error) {
    logError('flight_watches_get_failed', {
      requestId,
      user_id: context.userId,
      error: error.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ watches: data ?? [] })
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'flight_watches_create_ip',
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('flight_watches_create_rate_limited', { requestId })
    return rateLimitError
  }

  const context = await getAuthenticatedContext()
  if (!context.authUserId || !context.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateWatchPayload
  try {
    body = (await req.json()) as CreateWatchPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const origin = typeof body.origin === 'string' ? body.origin.trim().toUpperCase() : ''
  const destination = typeof body.destination === 'string' ? body.destination.trim().toUpperCase() : ''
  const cabin = typeof body.cabin === 'string' ? body.cabin.trim() : ''
  const startDate = parseIsoDate(body.start_date)
  const endDate = parseIsoDate(body.end_date)
  const maxPoints = parseMaxPoints(body.max_points)

  if (!IATA_RE.test(origin)) {
    return NextResponse.json({ error: 'origin must be a valid IATA code' }, { status: 400 })
  }
  if (!IATA_RE.test(destination)) {
    return NextResponse.json({ error: 'destination must be a valid IATA code' }, { status: 400 })
  }
  if (!CABINS.has(cabin)) {
    return NextResponse.json({ error: 'cabin must be one of economy, premium_economy, business, first' }, { status: 400 })
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start_date and end_date must be YYYY-MM-DD' }, { status: 400 })
  }
  if (maxPoints === 'invalid') {
    return NextResponse.json({ error: 'max_points must be a positive integer' }, { status: 400 })
  }

  const dateRangeError = validateDateRange(startDate, endDate)
  if (dateRangeError) {
    return NextResponse.json({ error: dateRangeError }, { status: 400 })
  }

  const { data, error } = await context.supabase
    .from('flight_watches')
    .insert({
      user_id: context.userId,
      origin,
      destination,
      cabin,
      start_date: startDate,
      end_date: endDate,
      max_points: maxPoints,
      is_active: true,
    })
    .select('id, origin, destination, cabin, start_date, end_date, max_points, is_active, last_checked_at, created_at')
    .single()

  if (error) {
    logError('flight_watches_create_failed', {
      requestId,
      user_id: context.userId,
      error: error.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, watch: data }, { status: 201 })
}
