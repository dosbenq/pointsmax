import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: programs, error: programsError } = await client
    .from('programs')
    .select('name, short_name, type, color_hex')
    .order('display_order')

  if (programsError) {
    return NextResponse.json({ error: programsError.message }, { status: 500 })
  }

  const { data: valuations, error: valuationsError } = await client
    .from('latest_valuations')
    .select('program_name, cpp_cents, source')
    .order('cpp_cents', { ascending: false })

  if (valuationsError) {
    return NextResponse.json({ error: valuationsError.message }, { status: 500 })
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
