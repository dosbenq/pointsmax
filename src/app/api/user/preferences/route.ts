import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

async function getCurrentUserRowId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authId: string,
): Promise<string | null> {
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .single()

  const id = (userRecord as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : null
}

// GET /api/user/preferences — returns preferences for current user
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getCurrentUserRowId(supabase, user.id)
  if (!userId) return NextResponse.json({ preferences: null })

  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  return NextResponse.json({ preferences: preferences ?? null })
}

// POST /api/user/preferences — upserts preferences for current user
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getCurrentUserRowId(supabase, user.id)
  if (!userId) return NextResponse.json({ error: 'User record not found' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const {
    home_airport,
    preferred_cabin,
    preferred_airlines,
    avoided_airlines,
  } = (body as {
    home_airport?: unknown
    preferred_cabin?: unknown
    preferred_airlines?: unknown
    avoided_airlines?: unknown
  })

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        home_airport: home_airport ?? null,
        preferred_cabin: preferred_cabin ?? 'any',
        preferred_airlines: preferred_airlines ?? [],
        avoided_airlines: avoided_airlines ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('user_preferences_upsert_failed', { user_id: userId, error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
