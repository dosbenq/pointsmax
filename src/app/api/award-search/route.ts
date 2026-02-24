import { NextRequest, NextResponse } from 'next/server'
import { createServerDbClient } from '@/lib/supabase'
import { AwardProviderUnavailableError, createAwardProvider } from '@/lib/award-search'
import { StubProvider } from '@/lib/award-search/stub-provider'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'
import {
  ESTIMATES_ONLY_MESSAGE,
  MAX_AWARD_SEARCH_BODY_BYTES,
  generateNarrative,
  pickNarrativeOptions,
  shouldGenerateNarrative,
  validateSearchParams,
} from './helpers'

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const startedAt = Date.now()

  const sizeError = enforceJsonContentLength(req, MAX_AWARD_SEARCH_BODY_BYTES)
  if (sizeError) {
    logWarn('award_search_payload_too_large', { requestId })
    return sizeError
  }

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'award_search_ip',
    maxRequests: 40,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('award_search_rate_limited', { requestId })
    return rateLimitError
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const includeNarrative = shouldGenerateNarrative(body)

  const validated = validateSearchParams(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const params = validated

  try {
    const client = createServerDbClient()
    const provider = createAwardProvider()

    const results = await provider.search(params, client)

    // Narrative generation can be skipped by client and fetched asynchronously.
    const ai_narrative = includeNarrative
      ? await generateNarrative(params, pickNarrativeOptions(results))
      : null

    logInfo('award_search_success', {
      requestId,
      provider: provider.name,
      result_count: results.length,
      ai_narrative_included: includeNarrative,
      latency_ms: Date.now() - startedAt,
    })

    return NextResponse.json({
      provider: provider.name,
      params,
      results,
      ai_narrative,
      searched_at: new Date().toISOString(),
    })
  } catch (err) {
    if (err instanceof AwardProviderUnavailableError) {
      logWarn('award_search_provider_unavailable', {
        requestId,
        error: err.message,
      })

      try {
        const client = createServerDbClient()
        const fallbackProvider = new StubProvider()
        const results = await fallbackProvider.search(params, client)
        const ai_narrative = includeNarrative
          ? await generateNarrative(params, pickNarrativeOptions(results))
          : null

        return NextResponse.json({
          provider: fallbackProvider.name,
          params,
          results,
          ai_narrative,
          searched_at: new Date().toISOString(),
          error: 'real_availability_unavailable',
          message: ESTIMATES_ONLY_MESSAGE,
        })
      } catch (fallbackErr) {
        logError('award_search_fallback_failed', {
          requestId,
          error: fallbackErr instanceof Error ? fallbackErr.message : 'fallback_failed',
        })
        return NextResponse.json(
          { error: 'Search failed' },
          { status: 500 },
        )
      }
    }

    logError('award_search_failed', {
      requestId,
      error: err instanceof Error ? err.message : 'Search failed',
      latency_ms: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 },
    )
  }
}
