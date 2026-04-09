import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: programs, error: programsError } = await client
    .from('programs')
    .select('name, short_name, type, color_hex')
    .order('display_order')

  if (programsError) {
    console.error('test_api_programs_query_failed', { error: programsError.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const { data: valuations, error: valuationsError } = await client
    .from('latest_valuations')
    .select('program_name, cpp_cents, source')
    .order('cpp_cents', { ascending: false })

  if (valuationsError) {
    console.error('test_api_valuations_query_failed', { error: valuationsError.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const { count: partnerCount } = await client
    .from('transfer_partners')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    status: 'connected',
    summary: {
      programs: programs.length,
      transfer_partners: partnerCount,
    },
    top_5_by_value: valuations.slice(0, 5),
    all_programs: programs,
  })
}
