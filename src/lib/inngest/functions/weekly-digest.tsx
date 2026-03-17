import { Resend } from 'resend'
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase'
import { calculateRedemptions } from '@/lib/calculate'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { renderEmail } from '@/lib/email-render'
import { WeeklyDigestEmail } from '@/emails/WeeklyDigestEmail'
import { createDigestUnsubscribeToken } from '@/lib/digest-email-token'

type DigestUserRow = {
  id: string
  email: string
}

type PreferenceRow = {
  user_id: string
  home_airport: string | null
  digest_email_enabled: boolean | null
}

type BalanceRow = {
  user_id: string
  program_id: string
  balance: number
}

type BonusRow = {
  bonus_pct: number
  from_program_name: string
  from_program_id: string
  to_program_name: string
}

type InspirationRouteRow = {
  headline: string
  destination_label: string
  miles_required: number
  cpp_cents: number
}

function inferRegion(homeAirport: string | null | undefined): 'US' | 'IN' {
  const indianAirports = new Set(['DEL', 'BOM', 'BLR', 'MAA', 'HYD'])
  return homeAirport && indianAirports.has(homeAirport.toUpperCase()) ? 'IN' : 'US'
}

export function summarizeBonuses(rows: BonusRow[]): string[] {
  return rows.map((row) => `${row.from_program_name} → ${row.to_program_name} (+${row.bonus_pct}%)`)
}

export const weeklyDigest = inngest.createFunction(
  { id: 'weekly-digest', name: 'Growth: Weekly Digest' },
  { cron: '0 8 * * 1' },
  async ({ step }) => {
    const resendKey = process.env.RESEND_API_KEY?.trim()
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()
    if (!resendKey || !fromEmail) {
      return { ok: false, skipped: true, reason: 'resend_not_configured' }
    }

    const db = createAdminClient()
    const resend = new Resend(resendKey)
    const appOrigin = getConfiguredAppOrigin()

    const [usersRes, prefsRes, balancesRes] = await Promise.all([
      db.from('users').select('id, email'),
      db.from('user_preferences').select('user_id, home_airport, digest_email_enabled'),
      db.from('user_balances').select('user_id, program_id, balance'),
    ])

    const users = (usersRes.data ?? []) as DigestUserRow[]
    const prefsByUserId = new Map(
      ((prefsRes.data ?? []) as PreferenceRow[]).map((row) => [row.user_id, row]),
    )
    const balancesByUserId = new Map<string, BalanceRow[]>()
    for (const balance of ((balancesRes.data ?? []) as BalanceRow[])) {
      const list = balancesByUserId.get(balance.user_id) ?? []
      list.push(balance)
      balancesByUserId.set(balance.user_id, list)
    }

    let sent = 0
    for (const user of users) {
      const prefs = prefsByUserId.get(user.id)
      if (prefs?.digest_email_enabled === false) continue

      const balances = (balancesByUserId.get(user.id) ?? []).filter((row) => row.balance > 0)
      if (balances.length === 0) continue

      const portfolio = await step.run(`calculate-portfolio-${user.id}`, async () => {
        return calculateRedemptions(
          balances.map((row) => ({
            program_id: row.program_id,
            amount: Math.max(0, Math.round(Number(row.balance) || 0)),
          })),
        )
      })

      const programIds = balances.map((row) => row.program_id)
      const [{ data: bonusesData }, { data: inspirationData }] = await Promise.all([
        db
          .from('active_bonuses')
          .select('bonus_pct, from_program_name, from_program_id, to_program_name')
          .in('from_program_id', programIds)
          .order('bonus_pct', { ascending: false })
          .limit(3),
        db
          .from('inspiration_routes')
          .select('headline, destination_label, miles_required, cpp_cents')
          .eq('region', inferRegion(prefs?.home_airport))
          .order('is_featured', { ascending: false })
          .order('display_order', { ascending: true })
          .limit(1),
      ])

      const bonuses = summarizeBonuses((bonusesData ?? []) as BonusRow[])
      const route = ((inspirationData ?? []) as InspirationRouteRow[])[0]
      const featuredRoute = route
        ? `${route.headline} to ${route.destination_label} for ${route.miles_required.toLocaleString()} miles (${route.cpp_cents.toFixed(1)}¢/pt)`
        : 'A featured award sweet spot is waiting in the planner.'

      const token = createDigestUnsubscribeToken(user.id)
      const unsubscribeUrl = `${appOrigin}/api/email/unsubscribe?token=${encodeURIComponent(token ?? '')}`

      await step.run(`send-weekly-digest-${user.id}`, async () => {
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: 'Your weekly PointsMax digest',
          html: await renderEmail(
            <WeeklyDigestEmail
              portfolioValue={`$${(portfolio.total_optimal_value_cents / 100).toLocaleString()}`}
              bonuses={bonuses}
              featuredRoute={featuredRoute}
              calculatorUrl={`${appOrigin}/${inferRegion(prefs?.home_airport).toLowerCase()}/calculator`}
              unsubscribeUrl={unsubscribeUrl}
            />,
          ),
        })
      })
      sent += 1
    }

    return { ok: true, emails_sent: sent }
  },
)
