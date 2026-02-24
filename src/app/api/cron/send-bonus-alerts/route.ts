// ============================================================
// GET /api/cron/send-bonus-alerts
// Vercel cron job: runs daily at 09:00 UTC
// Finds unalerted active bonuses, sends emails via Resend
// Auth: Authorization: Bearer CRON_SECRET or ?secret=CRON_SECRET
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase'
import { createUnsubscribeToken } from '@/lib/alerts-token'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'

type BonusRow = {
  id: string
  transfer_partner_id: string
  bonus_pct: number
  start_date: string
  end_date: string
}

type PartnerRow = {
  id: string
  from_program_id: string
  to_program_id: string
  from_program: { name?: string } | null
  to_program: { name?: string } | null
}

function isBonusRow(value: unknown): value is BonusRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.transfer_partner_id === 'string' &&
    typeof row.bonus_pct === 'number' &&
    typeof row.start_date === 'string' &&
    typeof row.end_date === 'string'
  )
}

function isPartnerRow(value: unknown): value is PartnerRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.from_program_id === 'string' &&
    typeof row.to_program_id === 'string'
  )
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  const param = req.nextUrl.searchParams.get('secret')
  return param === secret
}

function buildUnsubscribeLink(email: string): string {
  const token = createUnsubscribeToken(email)
  const base = getSafeAppUrl()
  if (!token) return `${base}/profile`
  return `${base}/api/alerts/unsubscribe?token=${token}`
}

function getSafeAppUrl(): string {
  const fallback = 'https://pointsmax.com'
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? fallback
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback
    return parsed.origin
  } catch {
    return fallback
  }
}

function buildEmailHtml(opts: {
  fromName: string
  toName: string
  bonusPct: number
  startDate: string
  endDate: string
  appUrl: string
  unsubscribeUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Transfer Bonus Alert</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <p style="margin:0;color:white;font-weight:600;font-size:1.1rem;">PointsMax</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:0.8rem;">Transfer Bonus Alert</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:1.5rem;color:#0f172a;">
              +${opts.bonusPct}% Transfer Bonus
            </h1>
            <p style="margin:0 0 24px;font-size:1.1rem;color:#334155;font-weight:500;">
              ${opts.fromName} → ${opts.toName}
            </p>
            <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;color:#065f46;font-size:0.875rem;">
                <strong>Active:</strong> ${opts.startDate} – ${opts.endDate}
              </p>
              <p style="margin:8px 0 0;color:#065f46;font-size:0.875rem;">
                Transfer your ${opts.fromName} points to ${opts.toName} now and get ${opts.bonusPct}% more miles/points.
              </p>
            </div>
            <a href="${opts.appUrl}/calculator"
               style="display:inline-block;background:#0f172a;color:white;text-decoration:none;font-size:0.875rem;font-weight:600;padding:12px 24px;border-radius:100px;">
              View in Calculator →
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;color:#94a3b8;font-size:0.75rem;">
              You're receiving this because you subscribed to transfer bonus alerts on PointsMax.
              <a href="${opts.unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const startedAt = Date.now()

  if (!isAuthorized(req)) {
    logWarn('cron_bonus_alerts_unauthorized', { requestId })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const appUrl = getSafeAppUrl()

  if (!resendKey || !fromEmail) {
    logError('cron_bonus_alerts_missing_env', {
      requestId,
      hasResendApiKey: !!resendKey,
      hasFromEmail: !!fromEmail,
    })
    return NextResponse.json({ error: 'RESEND_API_KEY or RESEND_FROM_EMAIL not configured' }, { status: 500 })
  }

  const db = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Find active bonuses that haven't been alerted yet
  const { data: bonusesRaw, error: bonusErr } = await db
    .from('transfer_bonuses')
    .select(`
      id, transfer_partner_id, bonus_pct, start_date, end_date
    `)
    .lte('start_date', today)
    .gte('end_date', today)
    .is('alerted_at', null)

  if (bonusErr) {
    logError('cron_bonus_alerts_fetch_failed', { requestId, error: bonusErr.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const bonuses = ((bonusesRaw ?? []) as unknown[]).filter(isBonusRow)

  if (bonuses.length === 0) {
    logInfo('cron_bonus_alerts_no_work', { requestId, latency_ms: Date.now() - startedAt })
    return NextResponse.json({ ok: true, bonuses_processed: 0, emails_sent: 0 })
  }

  const resend = new Resend(resendKey)
  let emailsSent = 0
  const failedBonusIds: string[] = []

  const partnerIds = [...new Set(bonuses.map(b => b.transfer_partner_id))]
  const { data: partnerRowsRaw, error: partnerErr } = await db
    .from('transfer_partners')
    .select(`
      id, from_program_id, to_program_id,
      from_program:programs!transfer_partners_from_program_id_fkey(name),
      to_program:programs!transfer_partners_to_program_id_fkey(name)
    `)
    .in('id', partnerIds)

  if (partnerErr) {
    logError('cron_bonus_alerts_partner_fetch_failed', { requestId, error: partnerErr.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const partnerRows = ((partnerRowsRaw ?? []) as unknown[]).filter(isPartnerRow)
  const partnerById = new Map<string, PartnerRow>(partnerRows.map((row) => [row.id, row]))
  const fromProgramIds = [
    ...new Set(partnerRows.map((row) => row.from_program_id).filter(Boolean)),
  ]

  const subscribersByProgram = new Map<string, string[]>()
  if (fromProgramIds.length > 0) {
    const { data: subscriberRows, error: subscriberErr } = await db
      .from('alert_subscriptions')
      .select('email, program_ids')
      .eq('is_active', true)
      .overlaps('program_ids', fromProgramIds)

    if (subscriberErr) {
      logError('cron_bonus_alerts_subscriber_fetch_failed', { requestId, error: subscriberErr.message })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    for (const row of (subscriberRows ?? []) as Array<{ email: unknown; program_ids: unknown }>) {
      if (typeof row.email !== 'string') continue
      if (!Array.isArray(row.program_ids)) continue
      for (const programId of row.program_ids) {
        if (typeof programId !== 'string') continue
        if (!fromProgramIds.includes(programId)) continue
        const list = subscribersByProgram.get(programId) ?? []
        list.push(row.email)
        subscribersByProgram.set(programId, list)
      }
    }
  }

  for (const bonus of bonuses) {
    const partnerDetail = partnerById.get(bonus.transfer_partner_id)

    if (!partnerDetail) {
      failedBonusIds.push(bonus.id)
      continue
    }

    const fromName = partnerDetail.from_program?.name ?? 'Unknown'
    const toName = partnerDetail.to_program?.name ?? 'Unknown'
    const fromProgramId = partnerDetail.from_program_id

    let bonusHadFailures = false
    let bonusEmailsSent = 0
    const emails = subscribersByProgram.get(fromProgramId) ?? []
    if (emails.length > 0) {
      const uniqueEmails = [...new Set(emails)]

      for (const email of uniqueEmails) {
        try {
          await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: `+${bonus.bonus_pct}% Transfer Bonus: ${fromName} → ${toName}`,
            html: buildEmailHtml({
              fromName,
              toName,
              bonusPct: bonus.bonus_pct,
              startDate: bonus.start_date,
              endDate: bonus.end_date,
              appUrl,
              unsubscribeUrl: buildUnsubscribeLink(email),
            }),
          })
          emailsSent++
          bonusEmailsSent++
        } catch (err) {
          bonusHadFailures = true
          logError('cron_bonus_alerts_email_failed', {
            requestId,
            bonusId: bonus.id,
            email,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    const hadSubscribers = emails.length > 0
    const shouldMarkAlerted =
      !hadSubscribers || bonusEmailsSent > 0 || (!bonusHadFailures && hadSubscribers)

    if (shouldMarkAlerted) {
      const { error: updateError } = await db
        .from('transfer_bonuses')
        .update({ alerted_at: new Date().toISOString() })
        .eq('id', bonus.id)

      if (updateError) {
        failedBonusIds.push(bonus.id)
        logError('cron_bonus_alerts_mark_failed', {
          requestId,
          bonusId: bonus.id,
          error: updateError.message,
        })
      }
    } else {
      failedBonusIds.push(bonus.id)
    }
  }

  logInfo('cron_bonus_alerts_complete', {
    requestId,
    bonuses_processed: bonuses.length,
    emails_sent: emailsSent,
    failed_bonus_ids: failedBonusIds,
    latency_ms: Date.now() - startedAt,
  })

  return NextResponse.json({
    ok: failedBonusIds.length === 0,
    bonuses_processed: bonuses.length,
    emails_sent: emailsSent,
    failed_bonus_ids: failedBonusIds,
  })
}
