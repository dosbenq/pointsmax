import { NextRequest, NextResponse } from 'next/server'
import { createServerDbClient } from '@/lib/supabase'
import { AwardProviderUnavailableError, createAwardProvider } from '@/lib/award-search'
import { sortAwardResultsByPoints } from '@/lib/award-search/sort-results'
import { StubProvider } from '@/lib/award-search/stub-provider'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'
import { badRequest, internalError } from '@/lib/error-utils'
import {
  ESTIMATES_ONLY_MESSAGE,
  MAX_AWARD_SEARCH_BODY_BYTES,
  generateNarrative,
  pickNarrativeOptions,
  shouldGenerateNarrative,
  validateSearchParams,
} from './helpers'

const DELTA_DYNAMIC_WARNING =
  'Delta SkyMiles uses dynamic pricing, so PointsMax does not show static Delta estimates. Check delta.com directly for live pricing.'

async function buildSearchWarnings(
  client: ReturnType<typeof createServerDbClient>,
  programIds: string[],
): Promise<string[]> {
  if (programIds.length === 0) return []
  const { data } = await client
    .from('programs')
    .select('id, slug')
    .in('id', programIds)

  const slugs = new Set(
    ((data ?? []) as Array<{ slug?: string | null }>)
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0),
  )

  const warnings: string[] = []
  if (slugs.has('delta')) {
    warnings.push(DELTA_DYNAMIC_WARNING)
  }
  return warnings
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const startedAt = Date.now()

  const sizeError = enforceJsonContentLength(req, MAX_AWARD_SEARCH_BODY_BYTES)
  if (sizeError) {
    logWarn('award_search_payload_too_large', { requestId })
    return sizeError
  }

  // Rate limit: 10 requests per minute per IP (external API calls behind it)
  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'award_search_ip',
    maxRequests: 10,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('award_search_rate_limited', { requestId })
    return rateLimitError
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }
  const includeNarrative = shouldGenerateNarrative(body)

  const validated = validateSearchParams(body)
  if ('error' in validated) {
    return badRequest(validated.error)
  }

  const params = validated

  try {
    const client = createServerDbClient()
    const provider = createAwardProvider()
    const warnings = await buildSearchWarnings(
      client,
      params.balances.map((balance) => balance.program_id),
    )

    const results = sortAwardResultsByPoints(await provider.search(params, client))

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
      warnings,
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
        const warnings = await buildSearchWarnings(
          client,
          params.balances.map((balance) => balance.program_id),
        )
        const results = sortAwardResultsByPoints(await fallbackProvider.search(params, client))
        const ai_narrative = includeNarrative
          ? await generateNarrative(params, pickNarrativeOptions(results))
          : null

        return NextResponse.json({
          provider: fallbackProvider.name,
          params,
          results,
          ai_narrative,
          warnings,
          searched_at: new Date().toISOString(),
          error: 'real_availability_unavailable',
          message: ESTIMATES_ONLY_MESSAGE,
          estimates_only: true,
        })
      } catch (fallbackErr) {
        logError('award_search_fallback_failed', {
          requestId,
          error: fallbackErr instanceof Error ? fallbackErr.message : 'fallback_failed',
        })
        return internalError('Search failed')
      }
    }

    logError('award_search_failed', {
      requestId,
      error: err instanceof Error ? err.message : 'Search failed',
      latency_ms: Date.now() - startedAt,
    })
    return internalError('Search failed')
  }
}
