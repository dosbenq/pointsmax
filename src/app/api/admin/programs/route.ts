import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'

type ProgramRow = {
  id: string
  [key: string]: unknown
}

type LatestValuationRow = {
  program_id: string
  [key: string]: unknown
}

export async function GET(req: Request) {
  const authError = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()

  const [{ data: programs }, { data: valuations }] = await Promise.all([
    db.from('programs').select('*').order('display_order'),
    db.from('latest_valuations').select('*'),
  ])

  const programRows = (programs ?? []) as ProgramRow[]
  const valuationRows = (valuations ?? []) as LatestValuationRow[]

  const result = programRows.map(p => ({
    ...p,
    latest_valuation: valuationRows.find(v => v.program_id === p.id) ?? null,
  }))

  return NextResponse.json({ programs: result })
}

// PATCH: insert a new valuation record for a program (keeps history)
export async function PATCH(request: Request) {
  const authError = await requireAdmin(request)
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
  } as never)

  if (error) {
    console.error('admin_programs_valuation_insert_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  await logAdminAction('valuation.update', String(program_id), {
    cpp_cents: parseFloat(cpp_cents),
    source: source ?? 'manual',
  })
  return NextResponse.json({ ok: true })
}
