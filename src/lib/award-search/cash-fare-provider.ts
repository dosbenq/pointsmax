import { createHash } from 'node:crypto'
import { createServerDbClient } from '@/lib/supabase'
import type { CabinClass } from './types'
import { logWarn } from '@/lib/logger'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000

type CashFareCacheRow = {
  id: string
  origin: string
  destination: string
  cabin: CabinClass
  travel_date: string
  fare_usd: number
  fetched_at: string
}

function buildCacheId(origin: string, destination: string, cabin: CabinClass, outboundDate: string): string {
  return createHash('sha256')
    .update(`${origin}:${destination}:${cabin}:${outboundDate}`)
    .digest('hex')
}

function cabinToTravelClass(cabin: CabinClass): string {
  switch (cabin) {
    case 'economy':
      return '1'
    case 'premium_economy':
      return '2'
    case 'business':
      return '3'
    case 'first':
      return '4'
  }
}

function parseFareUsd(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.]/g, '')
    const parsed = Number.parseFloat(cleaned)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed)
    }
  }

  return null
}

function isFresh(fetchedAt: string | null | undefined): boolean {
  if (typeof fetchedAt !== 'string') return false
  const age = Date.now() - new Date(fetchedAt).getTime()
  return Number.isFinite(age) && age >= 0 && age <= CACHE_TTL_MS
}

export async function fetchCashFareUsd(
  origin: string,
  destination: string,
  cabin: CabinClass,
  outboundDate: string,
): Promise<number | null> {
  const apiKey = process.env.SERPAPI_KEY?.trim()
  if (!apiKey) return null

  const cacheId = buildCacheId(origin, destination, cabin, outboundDate)
  const db = createServerDbClient()

  try {
    const { data } = await db
      .from('cash_fare_cache')
      .select('id, origin, destination, cabin, travel_date, fare_usd, fetched_at')
      .eq('id', cacheId)
      .single()

    const cached = (data ?? null) as CashFareCacheRow | null
    if (cached && isFresh(cached.fetched_at)) {
      return cached.fare_usd
    }
  } catch {
    // Cache miss or inaccessible cache should not fail award search.
  }

  try {
    const url = new URL('https://serpapi.com/search.json')
    url.searchParams.set('engine', 'google_flights')
    url.searchParams.set('departure_id', origin)
    url.searchParams.set('arrival_id', destination)
    url.searchParams.set('outbound_date', outboundDate)
    url.searchParams.set('travel_class', cabinToTravelClass(cabin))
    url.searchParams.set('currency', 'USD')
    url.searchParams.set('hl', 'en')
    url.searchParams.set('type', '2')
    url.searchParams.set('api_key', apiKey)

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!response.ok) {
      logWarn('cash_fare_provider_http_error', {
        origin,
        destination,
        cabin,
        outbound_date: outboundDate,
        status: response.status,
      })
      return null
    }

    const payload = await response.json() as {
      best_flights?: Array<{ price?: unknown }>
      other_flights?: Array<{ price?: unknown }>
    }
    const fareUsd = parseFareUsd(payload.best_flights?.[0]?.price)
      ?? parseFareUsd(payload.other_flights?.[0]?.price)

    if (fareUsd == null) return null

    try {
      await db
        .from('cash_fare_cache')
        .upsert({
          id: cacheId,
          origin,
          destination,
          cabin,
          travel_date: outboundDate,
          fare_usd: fareUsd,
          fetched_at: new Date().toISOString(),
        })
    } catch {
      // Cache write failure should not block the response.
    }

    return fareUsd
  } catch (error) {
    logWarn('cash_fare_provider_fetch_failed', {
      origin,
      destination,
      cabin,
      outbound_date: outboundDate,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
