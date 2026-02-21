import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/user/balances — returns saved balances for current user
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up users.id via auth_id
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!userRecord) return NextResponse.json({ balances: [] })

  const { data: balances } = await supabase
    .from('user_balances')
    .select('program_id, balance')
    .eq('user_id', userRecord.id)

  return NextResponse.json({ balances: balances ?? [] })
}

// POST /api/user/balances — upserts balances for current user
// Body: { balances: [{ program_id: string, balance: number }] }
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { balances } = await req.json()
  if (!Array.isArray(balances)) {
    return NextResponse.json({ error: 'balances must be an array' }, { status: 400 })
  }

  // Look up users.id via auth_id
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!userRecord) return NextResponse.json({ error: 'User record not found' }, { status: 404 })

  // Upsert each balance
  const rows = balances.map((b: { program_id: string; balance: number }) => ({
    user_id: userRecord.id,
    program_id: b.program_id,
    balance: b.balance,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('user_balances')
    .upsert(rows, { onConflict: 'user_id,program_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
