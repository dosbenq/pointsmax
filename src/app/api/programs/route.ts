import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase'

// GET /api/programs
// Returns all active programs for the calculator dropdown
export async function GET() {
  const client = createPublicClient()

  const { data, error } = await client
    .from('programs')
    .select('id, name, short_name, slug, type, color_hex')
    .eq('is_active', true)
    .order('display_order')

  if (error) {
    console.error('programs_api_fetch_failed', error.message)
    return NextResponse.json({ error: 'Failed to load programs' }, { status: 500 })
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
