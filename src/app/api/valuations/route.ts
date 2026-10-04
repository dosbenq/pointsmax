import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { latestValuations } from '@/lib/db/schema'
import { enforceRateLimit } from '@/lib/api-security'
import { logError } from '@/lib/logger'

export async function GET(request: Request) {
  const rateLimitError = await enforceRateLimit(request, {
    namespace: 'valuations_ip',
    maxRequests: 60,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  try {
    const data = await getDb()
      .select({
        program_id: latestValuations.programId,
        program_name: latestValuations.programName,
        cpp_cents: latestValuations.cppCents,
        source: latestValuations.source,
        source_url: latestValuations.sourceUrl,
        notes: latestValuations.notes,
        reviewed_at: latestValuations.effectiveDate,
        // Kept for API compatibility; the view never had an updated_at column.
        updated_at: latestValuations.effectiveDate,
      })
      .from(latestValuations)
      .orderBy(asc(latestValuations.programName))

    return NextResponse.json({ valuations: data }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    logError('valuations_fetch_failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to load valuations' },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }
}
