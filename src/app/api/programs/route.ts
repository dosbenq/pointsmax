import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase'
import { enforceRateLimit } from '@/lib/api-security'
import { logError } from '@/lib/logger'
import { internalError } from '@/lib/error-utils'

// GET /api/programs
// Returns all active programs for the calculator dropdown
export async function GET(request: Request) {
  // Rate limit: 60 requests per minute per IP
  const rateLimitError = await enforceRateLimit(request, {
    namespace: 'programs_ip',
    maxRequests: 60,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const client = createPublicClient()
  const url = new URL(request.url)
  const regionRaw = (url.searchParams.get('region') ?? '').trim().toUpperCase()
  const region = regionRaw === 'US' || regionRaw === 'IN' ? regionRaw : null

  let query = client
    .from('programs')
    .select('id, name, short_name, slug, type, color_hex, geography')
    .eq('is_active', true)
    .order('display_order')

  if (region) {
    query = query.in('geography', ['global', region])
  }

  let { data, error } = await query

  // Backward compatibility before geography migration is applied.
  if (error && (error as { code?: string }).code === '42703') {
    const legacy = await client
      .from('programs')
      .select('id, name, short_name, slug, type, color_hex')
      .eq('is_active', true)
      .order('display_order')

    data = (legacy.data ?? []).map((row) => ({ ...row, geography: 'global' }))
    error = legacy.error
  }

  if (error) {
    logError('programs_api_fetch_failed', { message: error.message })
    return internalError('Failed to load programs')
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
