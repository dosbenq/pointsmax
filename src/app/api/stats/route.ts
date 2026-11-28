import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { sharedTrips, userBalances, users } from '@/lib/db/schema'
import { ensureDatabaseReady } from '@/lib/db/ready'
import { count, sql } from 'drizzle-orm'
import { enforceRateLimit } from '@/lib/api-security'
import { logError } from '@/lib/logger'

type CachedStats = {
  expiresAt: number
  payload: {
    users: number
    pointsOptimized: number
    trackedPoints: number
  }
}

function getCacheStore(): { stats?: CachedStats } {
  const globalState = globalThis as typeof globalThis & { __pointsmaxStatsCache?: { stats?: CachedStats } }
  if (!globalState.__pointsmaxStatsCache) {
    globalState.__pointsmaxStatsCache = {}
  }
  return globalState.__pointsmaxStatsCache
}

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_HOUR_SECONDS = 60 * 60
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? ''
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? ''
const HAS_UPSTASH = !!UPSTASH_URL && !!UPSTASH_TOKEN
const CACHE_KEY = 'site_stats_v1'

async function getUpstashCache(): Promise<CachedStats['payload'] | null> {
  if (!HAS_UPSTASH) return null
  try {
    const res = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', CACHE_KEY]),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const payload = (await res.json()) as { result?: string }
    if (!payload.result) return null
    const parsed = JSON.parse(payload.result) as CachedStats['payload']
    if (typeof parsed.users !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

async function setUpstashCache(payload: CachedStats['payload']): Promise<void> {
  if (!HAS_UPSTASH) return
  try {
    await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SETEX', CACHE_KEY, String(ONE_HOUR_SECONDS), JSON.stringify(payload)]),
      cache: 'no-store',
    })
  } catch {
    // cache errors are non-fatal
  }
}

export async function GET(req: Request) {
  const rateLimitResponse = await enforceRateLimit(req, {
    namespace: 'stats_ip',
    maxRequests: 60,
    windowMs: 60 * 1000,
  })
  if (rateLimitResponse) return rateLimitResponse

  const cache = getCacheStore()
  const now = Date.now()
  const distributed = await getUpstashCache()
  if (distributed) {
    return NextResponse.json(distributed, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  }
  if (cache.stats && cache.stats.expiresAt > now) {
    return NextResponse.json(cache.stats.payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  }

  let data: { user_count: number | null; tracked_points: number | null; optimized_value_cents: number | null } | undefined
  let error: unknown = null
  try {
    await ensureDatabaseReady()
    const db = getDb()
    const [[people], [points], [trips]] = await Promise.all([
      db.select({ total: count() }).from(users),
      db.select({ total: sql<number>`coalesce(sum(${userBalances.balance}), 0)`.mapWith(Number) }).from(userBalances),
      db
        .select({
          total: sql<number>`coalesce(sum(case when (${sharedTrips.tripData}->>'total_value_cents') ~ '^[0-9]+$' then (${sharedTrips.tripData}->>'total_value_cents')::bigint else 0 end), 0)`.mapWith(Number),
        })
        .from(sharedTrips),
    ])
    data = { user_count: people.total, tracked_points: points.total, optimized_value_cents: trips.total }
  } catch (err) {
    error = err
  }

  if (error) {
    logError('public_stats_fetch_failed', { error: error instanceof Error ? error.message : String(error) })
    // Return fallback stats so the frontend doesn't crash
    const fallbackPayload = {
      users: 0,
      trackedPoints: 0,
      pointsOptimized: 0,
      isFallback: true,
      valueUsd: 0,
      valueInr: 0,
    }
    return NextResponse.json(fallbackPayload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  }

  const basePayload = {
    users: Number(data?.user_count ?? 0),
    trackedPoints: Number(data?.tracked_points ?? 0),
    pointsOptimized: Number(data?.optimized_value_cents ?? 0),
  }
  
  // Include both USD and INR values for regional display
  const payload = {
    ...basePayload,
    // Original USD values
    valueUsd: Math.round(basePayload.pointsOptimized / 100),
    // Approximate INR conversion (1 USD ≈ 83 INR)
    valueInr: Math.round(basePayload.pointsOptimized * 0.83),
  }
  cache.stats = {
    payload,
    expiresAt: now + ONE_HOUR_MS,
  }
  await setUpstashCache(payload)

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
