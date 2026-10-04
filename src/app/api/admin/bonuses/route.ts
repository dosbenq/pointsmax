import { NextResponse } from 'next/server'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { programs as programsTable, transferBonuses, transferPartners } from '@/lib/db/schema'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = getDb()
  const [bonusRows, partnerRows, programs] = await Promise.all([
    db.select(columnsOf(transferBonuses)).from(transferBonuses).orderBy(desc(transferBonuses.startDate)),
    db.select({
      id: transferPartners.id,
      from_program_id: transferPartners.fromProgramId,
      to_program_id: transferPartners.toProgramId,
    }).from(transferPartners).where(eq(transferPartners.isActive, true)),
    db.select({ id: programsTable.id, name: programsTable.name, short_name: programsTable.shortName })
      .from(programsTable)
      .where(eq(programsTable.isActive, true)),
  ])
  const partners = partnerRows.map(p => ({
    id: p.id,
    from_program_id: p.from_program_id,
    to_program_id: p.to_program_id,
    from_program_name:
      programs.find(prog => prog.id === p.from_program_id)?.name ?? 'Unknown',
    to_program_name:
      programs.find(prog => prog.id === p.to_program_id)?.name ?? 'Unknown',
  }))

  const bonuses = bonusRows.map(bonus => {
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
  const { error: authError, adminEmail } = await requireAdmin(request)
  if (authError) return authError

  const { transfer_partner_id, bonus_pct, start_date, end_date, source_url, notes } =
    await request.json()

  if (!transfer_partner_id || !bonus_pct || !start_date || !end_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate dates
  if (start_date && end_date) {
    const start = new Date(start_date)
    const end = new Date(end_date)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    if (start >= end) {
      return NextResponse.json({ error: 'start_date must be before end_date' }, { status: 400 })
    }
  }

  const parsedBonusPct = Number.parseFloat(String(bonus_pct))
  if (!Number.isFinite(parsedBonusPct) || parsedBonusPct <= 0) {
    return NextResponse.json({ error: 'bonus_pct must be a positive number' }, { status: 400 })
  }

  try {
    await getDb().insert(transferBonuses).values({
      transferPartnerId: transfer_partner_id,
      bonusPct: Math.round(parsedBonusPct),
      startDate: start_date,
      endDate: end_date,
      sourceUrl: source_url || null,
      notes: notes || null,
      verified: true,
      isVerified: true,
      active: true,
      autoDetected: false,
    })
  } catch (error) {
    console.error('admin_bonuses_insert_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  await logAdminAction('bonus.create', String(transfer_partner_id), {
    bonus_pct: parsedBonusPct,
    start_date,
    end_date,
    source_url: source_url || null,
  }, adminEmail!)

  // Fire-and-forget: trigger alert emails if the bonus starts today
  const today = new Date().toISOString().split('T')[0]
  if (start_date === today) {
    const secret = process.env.CRON_SECRET
    const appUrl = getConfiguredAppOrigin()
    if (secret) {
      fetch(`${appUrl}/api/cron/send-bonus-alerts`, {
        headers: { Authorization: `Bearer ${secret}` },
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
