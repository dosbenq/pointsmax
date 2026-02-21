import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError

  const db = createAdminClient()

  const [{ data: programs }, { data: valuations }] = await Promise.all([
    db.from('programs').select('*').order('display_order'),
    db.from('latest_valuations').select('*'),
  ])

  const result = (programs ?? []).map(p => ({
    ...p,
    latest_valuation: (valuations ?? []).find(v => v.program_id === p.id) ?? null,
  }))

  return NextResponse.json({ programs: result })
}

// PATCH: insert a new valuation record for a program (keeps history)
export async function PATCH(request: Request) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { program_id, cpp_cents, source } = await request.json()
  if (!program_id || cpp_cents == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const db = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { error } = await db.from('valuations').insert({
    program_id,
    cpp_cents: parseFloat(cpp_cents),
    source: source ?? 'manual',
    effective_date: today,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
