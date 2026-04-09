import { NextResponse } from 'next/server'
import { createServerDbClient } from '@/lib/supabase'
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
    const db = createServerDbClient()
    const { data, error } = await db
      .from('latest_valuations')
      .select('program_id, program_name, cpp_cents, source, source_url, notes, updated_at')
      .order('program_name')

    if (error) {
      logError('valuations_fetch_failed', { error: error.message })
      return NextResponse.json(
        { error: 'Failed to load valuations' },
        { status: 503, headers: { 'Retry-After': '30' } }
      )
    }

    return NextResponse.json({ valuations: data ?? [] }, {
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
