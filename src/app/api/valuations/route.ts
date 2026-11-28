import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api-security'
import { getCatalogLatestValuations } from '@/lib/catalog'

// GET /api/valuations — the current point value for every active program.
export async function GET(request: Request) {
  const rateLimitError = await enforceRateLimit(request, {
    namespace: 'valuations_ip',
    maxRequests: 60,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const valuations = getCatalogLatestValuations()
    .map((row) => ({
      program_id: row.program_id,
      program_name: row.program_name,
      program_slug: row.program_slug,
      cpp_cents: row.cpp_cents,
      source: row.source,
      source_url: row.source_url,
      notes: row.notes,
      effective_date: row.effective_date,
      // Kept for older clients that read the review date from `updated_at`.
      updated_at: row.effective_date,
    }))
    .sort((left, right) => left.program_name.localeCompare(right.program_name))

  return NextResponse.json({ valuations }, {
    headers: {
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  })
}
