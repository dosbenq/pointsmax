import { NextRequest, NextResponse } from 'next/server'
import { createServerDbClient } from '@/lib/supabase'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { badRequest, internalError } from '@/lib/error-utils'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'
import { createHotelSearchProvider, type HotelDestinationRegion, type HotelSearchParams } from '@/lib/hotel-search'

const MAX_HOTEL_SEARCH_BODY_BYTES = 10 * 1024

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isHotelDestinationRegion(value: string): value is HotelDestinationRegion {
  return [
    'north_america',
    'europe',
    'middle_east_africa',
    'asia_pacific',
    'latin_america',
    'india',
  ].includes(value)
}

function validateSearchParams(body: unknown): HotelSearchParams | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be an object' }
  }

  const candidate = body as Record<string, unknown>
  if (!isHotelDestinationRegion(String(candidate.destination_region ?? ''))) {
    return { error: 'destination_region is invalid' }
  }

  if (!isIsoDate(String(candidate.check_in ?? '')) || !isIsoDate(String(candidate.check_out ?? ''))) {
    return { error: 'check_in and check_out must be YYYY-MM-DD' }
  }

  const checkIn = String(candidate.check_in)
  const checkOut = String(candidate.check_out)
  if (Date.parse(`${checkOut}T00:00:00Z`) <= Date.parse(`${checkIn}T00:00:00Z`)) {
    return { error: 'check_out must be after check_in' }
  }

  const rawBalances = Array.isArray(candidate.balances) ? candidate.balances : []
  const balances = rawBalances
    .filter((row): row is { program_id: string; amount: number } => {
      if (!row || typeof row !== 'object') return false
      const record = row as Record<string, unknown>
      return typeof record.program_id === 'string' && Number(record.amount) > 0
    })
    .map((row) => ({
      program_id: row.program_id,
      amount: Math.floor(Number(row.amount)),
    }))

  return {
    destination_region: candidate.destination_region as HotelDestinationRegion,
    check_in: checkIn,
    check_out: checkOut,
    balances,
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const startedAt = Date.now()

  const sizeError = enforceJsonContentLength(req, MAX_HOTEL_SEARCH_BODY_BYTES)
  if (sizeError) {
    logWarn('hotel_search_payload_too_large', { requestId })
    return sizeError
  }

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'hotel_search_ip',
    maxRequests: 10,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('hotel_search_rate_limited', { requestId })
    return rateLimitError
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  const params = validateSearchParams(body)
  if ('error' in params) return badRequest(params.error)

  try {
    const client = createServerDbClient()
    const provider = createHotelSearchProvider()
    const results = await provider.search(params, client)

    logInfo('hotel_search_success', {
      requestId,
      destination_region: params.destination_region,
      result_count: results.length,
      balance_count: params.balances.length,
      latency_ms: Date.now() - startedAt,
    })

    return NextResponse.json({
      params,
      results,
      searched_at: new Date().toISOString(),
    })
  } catch (error) {
    logError('hotel_search_failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Hotel search failed',
      latency_ms: Date.now() - startedAt,
    })
    return internalError('Hotel search failed')
  }
}
