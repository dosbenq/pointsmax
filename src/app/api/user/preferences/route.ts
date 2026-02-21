import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/user/preferences — returns preferences for current user
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!userRecord) return NextResponse.json({ preferences: null })

  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userRecord.id)
    .single()

  return NextResponse.json({ preferences: preferences ?? null })
}

// POST /api/user/preferences — upserts preferences for current user
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!userRecord) return NextResponse.json({ error: 'User record not found' }, { status: 404 })

  const body = await req.json()
  const { home_airport, preferred_cabin, preferred_airlines, avoided_airlines } = body

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userRecord.id,
        home_airport: home_airport ?? null,
        preferred_cabin: preferred_cabin ?? 'any',
        preferred_airlines: preferred_airlines ?? [],
        avoided_airlines: avoided_airlines ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('user_preferences_upsert_failed', { user_id: userRecord.id, error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
