import { NextRequest, NextResponse } from 'next/server'
import { calculateRedemptions } from '@/lib/calculate'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { logError, getRequestId } from '@/lib/logger'
import { badRequest, internalError } from '@/lib/error-utils'
import type { BalanceInput } from '@/types/database'
import {
  generateAiCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
  logAiCacheMetric,
} from '@/lib/ai-cache'

const MAX_BODY_BYTES = 48_000
const RESULT_CACHE_TTL_MS = Number.parseInt(
  process.env.CALCULATE_RESULT_CACHE_TTL_MS ?? '15000',
  10,
)

function getNormalizedBalances(balances: BalanceInput[]) {
  return balances
    .map((b) => ({
      program_id: b.program_id,
      amount: Math.floor(b.amount),
    }))
    .sort((a, b) => a.program_id.localeCompare(b.program_id))
}

// POST /api/calculate
// Body: { balances: [{ program_id: string, amount: number }] }
// Returns: ranked redemption options with dollar values
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
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

  if (balances.length > 50) {
    return badRequest('Too many balances. Maximum 50 allowed.')
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
  const normalizedBalances = getNormalizedBalances(balances)
  const cacheKey = generateAiCacheKey('calculate', normalizedBalances)
  const cached = getCachedAiResponse<unknown>(cacheKey)
  
  if (cached) {
    logAiCacheMetric('hit', 'calculate', requestId)
    return NextResponse.json(cached, {
      headers: {
        'X-PointsMax-Cache': 'HIT',
        'X-Calculate-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }
  logAiCacheMetric('miss', 'calculate', requestId)

  try {
    const result = await calculateRedemptions(balances)
    const responsePayload = { ...result, valuation_source: 'TPG April 2026' }
    setCachedAiResponse(cacheKey, responsePayload, cacheTtl)
    return NextResponse.json(responsePayload, {
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
