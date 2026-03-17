import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase'
import { inngest } from '@/lib/inngest/client'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { region?: unknown; home_airport?: unknown }
  const region = body.region === 'in' ? 'in' : 'us'
  const homeAirport = typeof body.home_airport === 'string' ? body.home_airport.trim().toUpperCase() : null

  const db = createAdminClient()
  const { data: userRow } = await db.from('users').select('id').eq('auth_id', user.id).single()
  const internalUserId = (userRow as { id?: unknown } | null)?.id

  if (typeof internalUserId !== 'string') {
    return NextResponse.json({ error: 'User record not found' }, { status: 404 })
  }

  await inngest.send({
    name: 'user.onboarding_completed',
    data: {
      user_id: internalUserId,
      region,
      home_airport: homeAirport,
    },
  })

  return NextResponse.json({ ok: true })
}
