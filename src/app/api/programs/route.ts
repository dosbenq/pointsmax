// ============================================================
// GET /api/programs
// Returns all active programs for the calculator dropdown
// ============================================================

import { NextResponse } from 'next/server'
import { getActivePrograms } from '@/lib/db/programs'
import { enforceRateLimit } from '@/lib/api-security'
import { logError } from '@/lib/logger'

export async function GET(request: Request) {
  // Rate limit: 60 requests per minute per IP
  const rateLimitError = await enforceRateLimit(request, {
    namespace: 'programs_ip',
    maxRequests: 60,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const url = new URL(request.url)
  const regionRaw = (url.searchParams.get('region') ?? '').trim().toUpperCase()
  const region = regionRaw === 'US' || regionRaw === 'IN' ? regionRaw : null

  try {
    const programs = await getActivePrograms(region)

    // Add region to cache key via Vary header, but disable caching to ensure
    // region-specific data is never mixed. Client-side caching is handled by React Query/SWR if needed.
    return NextResponse.json(programs, {
      headers: {
        'Cache-Control': 'no-store, private',
        'Vary': 'Accept-Encoding',
      },
    })
  } catch (error) {
    logError('programs_fetch_failed', {
      region,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to load programs' },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }
}
