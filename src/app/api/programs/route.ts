import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// GET /api/programs
// Returns all active programs for the calculator dropdown
export async function GET() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await client
    .from('programs')
    .select('id, name, short_name, slug, type, color_hex')
    .eq('is_active', true)
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
