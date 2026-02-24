import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logWarn } from '@/lib/logger'
import {
  generateNarrative,
  parseNarrativeOptionsParam,
  parseNarrativeParamsParam,
} from '../helpers'

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'award_search_narrative_ip',
    maxRequests: 60,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('award_search_narrative_rate_limited', { requestId })
    return rateLimitError
  }

  const paramsRaw = req.nextUrl.searchParams.get('params')
  const resultsRaw = req.nextUrl.searchParams.get('results')

  const params = parseNarrativeParamsParam(paramsRaw)
  if ('error' in params) {
    return NextResponse.json({ error: params.error }, { status: 400 })
  }

  const results = parseNarrativeOptionsParam(resultsRaw)
  if ('error' in results) {
    return NextResponse.json({ error: results.error }, { status: 400 })
  }

  try {
    const narrative = await generateNarrative(params, results)
    return NextResponse.json({
      ai_narrative: narrative,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    logError('award_search_narrative_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 })
  }
}
