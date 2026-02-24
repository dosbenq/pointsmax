import { NextRequest, NextResponse } from 'next/server'
import { calculateRedemptions } from '@/lib/calculate'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { logError } from '@/lib/logger'
import { badRequest, internalError } from '@/lib/error-utils'
import type { BalanceInput } from '@/types/database'

const MAX_BODY_BYTES = 48_000
const RESULT_CACHE_TTL_MS = Number.parseInt(
  process.env.CALCULATE_RESULT_CACHE_TTL_MS ?? '15000',
  10,
)

type ResultCacheEntry = {
  expiresAt: number
  data: unknown
}

function getResultCacheStore(): Map<string, ResultCacheEntry> {
  const globalRef = globalThis as typeof globalThis & {
    __pointsmaxCalculateResultCache?: Map<string, ResultCacheEntry>
  }
  if (!globalRef.__pointsmaxCalculateResultCache) {
    globalRef.__pointsmaxCalculateResultCache = new Map<string, ResultCacheEntry>()
  }
  return globalRef.__pointsmaxCalculateResultCache
}

function pruneExpiredEntries(store: Map<string, ResultCacheEntry>, now: number) {
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) store.delete(key)
  }
  if (store.size <= 500) return
  const keys = store.keys()
  while (store.size > 500) {
    const next = keys.next()
    if (next.done) break
    store.delete(next.value)
  }
}

function balancesCacheKey(balances: BalanceInput[]): string {
  const normalized = balances
    .map((b) => ({
      program_id: b.program_id,
      amount: Math.floor(b.amount),
    }))
    .sort((a, b) => a.program_id.localeCompare(b.program_id))
  return JSON.stringify(normalized)
}

// POST /api/calculate
// Body: { balances: [{ program_id: string, amount: number }] }
// Returns: ranked redemption options with dollar values
export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError

  // Rate limit: 20 requests per minute per IP (computationally heavier)
  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'calculate_ip',
    maxRequests: 20,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  let body: { balances: BalanceInput[] }

  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const { balances } = body

  if (!Array.isArray(balances) || balances.length === 0) {
    return badRequest('Provide at least one balance')
  }

  // Validate each balance entry
  for (const b of balances) {
    if (!b.program_id || typeof b.amount !== 'number' || b.amount <= 0) {
      return badRequest('Each balance needs a program_id and a positive amount')
    }
  }

  const cacheTtl = Number.isFinite(RESULT_CACHE_TTL_MS) && RESULT_CACHE_TTL_MS > 0
    ? RESULT_CACHE_TTL_MS
    : 15000
  const cacheKey = balancesCacheKey(balances)
  const resultCache = getResultCacheStore()
  const now = Date.now()
  pruneExpiredEntries(resultCache, now)
  const cached = resultCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: {
        'X-PointsMax-Cache': 'HIT',
        'X-Calculate-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }

  try {
    const result = await calculateRedemptions(balances)
    resultCache.set(cacheKey, {
      data: result,
      expiresAt: now + cacheTtl,
    })
    return NextResponse.json(result, {
      headers: {
        'X-PointsMax-Cache': 'MISS',
        'X-Calculate-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  } catch (err) {
    logError('calculation_failed', { error: err instanceof Error ? err.message : String(err) })
    return internalError('Calculation failed')
  }
}
