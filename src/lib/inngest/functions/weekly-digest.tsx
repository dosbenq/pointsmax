import { Resend } from 'resend'
import { inngest } from '../client'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { activeBonuses, inspirationRoutes, userBalances, userPreferences, users } from '@/lib/db/schema'
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

    const db = getDb()
    const resend = new Resend(resendKey)
    const appOrigin = getConfiguredAppOrigin()

    // Only fetch users who have digest enabled
    const eligibleUsers = await db
      .select({
        user_id: userPreferences.userId,
        home_airport: userPreferences.homeAirport,
        digest_email_enabled: userPreferences.digestEmailEnabled,
        email: users.email,
      })
      .from(userPreferences)
      .innerJoin(users, eq(users.id, userPreferences.userId))
      .where(eq(userPreferences.digestEmailEnabled, true))
      .limit(500)

    // Then fetch balances only for eligible users
    const eligibleUserIds = eligibleUsers.map((u) => u.user_id)

    const balancesData: BalanceRow[] = eligibleUserIds.length > 0
      ? await db
          .select({ user_id: userBalances.userId, program_id: userBalances.programId, balance: userBalances.balance })
          .from(userBalances)
          .where(inArray(userBalances.userId, eligibleUserIds))
      : []

    const balancesByUserId = new Map<string, BalanceRow[]>()
    for (const balance of balancesData) {
      const list = balancesByUserId.get(balance.user_id) ?? []
      list.push(balance)
      balancesByUserId.set(balance.user_id, list)
    }

    let sent = 0
    for (const row of eligibleUsers) {
      const user: DigestUserRow = { id: row.user_id, email: row.email }
      const prefs: PreferenceRow = { user_id: row.user_id, home_airport: row.home_airport, digest_email_enabled: row.digest_email_enabled }

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
      const [bonusesData, inspirationData] = await Promise.all([
        db
          .select({
            bonus_pct: activeBonuses.bonusPct,
            from_program_name: activeBonuses.fromProgramName,
            from_program_id: activeBonuses.fromProgramId,
            to_program_name: activeBonuses.toProgramName,
          })
          .from(activeBonuses)
          .where(inArray(activeBonuses.fromProgramId, programIds))
          .orderBy(desc(activeBonuses.bonusPct))
          .limit(3),
        db
          .select({
            headline: inspirationRoutes.headline,
            destination_label: inspirationRoutes.destinationLabel,
            miles_required: inspirationRoutes.milesRequired,
            cpp_cents: inspirationRoutes.cppCents,
          })
          .from(inspirationRoutes)
          .where(eq(inspirationRoutes.region, inferRegion(prefs?.home_airport)))
          .orderBy(desc(inspirationRoutes.isFeatured), asc(inspirationRoutes.displayOrder))
          .limit(1),
      ])

      const bonuses = summarizeBonuses(bonusesData as BonusRow[])
      const route: InspirationRouteRow | undefined = inspirationData[0]
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
