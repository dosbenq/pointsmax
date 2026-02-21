import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

function getSafeAppUrl(): string {
  const fallback =
    process.env.NODE_ENV === 'production'
      ? 'https://pointsmax.com'
      : 'http://localhost:3000'
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? fallback
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback
    return parsed.origin
  } catch {
    return fallback
  }
}

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

  const parsedBonusPct = Number.parseFloat(String(bonus_pct))
  if (!Number.isFinite(parsedBonusPct) || parsedBonusPct <= 0) {
    return NextResponse.json({ error: 'bonus_pct must be a positive number' }, { status: 400 })
  }

  const db = createAdminClient()

  const { error } = await db.from('transfer_bonuses').insert({
    transfer_partner_id,
    bonus_pct: parsedBonusPct,
    start_date,
    end_date,
    source_url: source_url || null,
    notes: notes || null,
    is_verified: false,
  })

  if (error) {
    console.error('admin_bonuses_insert_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // Fire-and-forget: trigger alert emails if the bonus starts today
  const today = new Date().toISOString().split('T')[0]
  if (start_date === today) {
    const secret = process.env.CRON_SECRET
    const appUrl = getSafeAppUrl()
    if (secret) {
      fetch(`${appUrl}/api/cron/send-bonus-alerts`, {
        headers: { Authorization: `Bearer ${secret}` },
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
