import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError

  const db = createAdminClient()

  const [bonusesRes, partnersRes, programsRes] = await Promise.all([
    db.from('transfer_bonuses').select('*').order('start_date', { ascending: false }),
    db.from('transfer_partners')
      .select('id, from_program_id, to_program_id')
      .eq('is_active', true),
    db.from('programs').select('id, name, short_name').eq('is_active', true),
  ])

  const programs = programsRes.data ?? []
  const partners = (partnersRes.data ?? []).map(p => ({
    id: p.id,
    from_program_id: p.from_program_id,
    to_program_id: p.to_program_id,
    from_program_name:
      programs.find(prog => prog.id === p.from_program_id)?.name ?? 'Unknown',
    to_program_name:
      programs.find(prog => prog.id === p.to_program_id)?.name ?? 'Unknown',
  }))

  const bonuses = (bonusesRes.data ?? []).map(bonus => {
    const partner = partners.find(p => p.id === bonus.transfer_partner_id)
    return {
      ...bonus,
      from_program: partner
        ? (programs.find(p => p.id === partner.from_program_id) ?? null)
        : null,
      to_program: partner
        ? (programs.find(p => p.id === partner.to_program_id) ?? null)
        : null,
    }
  })

  return NextResponse.json({ bonuses, partners })
}

export async function POST(request: Request) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { transfer_partner_id, bonus_pct, start_date, end_date, source_url, notes } =
    await request.json()

  if (!transfer_partner_id || !bonus_pct || !start_date || !end_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createAdminClient()

  const { error } = await db.from('transfer_bonuses').insert({
    transfer_partner_id,
    bonus_pct: parseInt(bonus_pct),
    start_date,
    end_date,
    source_url: source_url || null,
    notes: notes || null,
    is_verified: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
