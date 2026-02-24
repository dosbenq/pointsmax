import { Resend } from 'resend'
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase'

type UserRow = {
  id: string
  email: string
  created_at: string
}

type EmailLogRow = {
  user_id: string
  email_kind: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://pointsmax.com'
}

function daysSince(iso: string): number {
  const created = Date.parse(iso)
  if (!Number.isFinite(created)) return 0
  return Math.floor((Date.now() - created) / MS_PER_DAY)
}

export const onboardingDrip = inngest.createFunction(
  { id: 'onboarding-drip', name: 'Agent: Onboarding Email Drip' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const resendKey = process.env.RESEND_API_KEY?.trim()
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()
    if (!resendKey || !fromEmail) {
      return { ok: false, skipped: true, reason: 'resend_not_configured' }
    }

    const db = createAdminClient()
    const resend = new Resend(resendKey)
    const threshold = new Date(Date.now() - 8 * MS_PER_DAY).toISOString()

    const users = await step.run('load-recent-users', async () => {
      const { data, error } = await db
        .from('users')
        .select('id, email, created_at')
        .gte('created_at', threshold)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as UserRow[]
    })

    const sent = await step.run('send-onboarding-sequence', async () => {
      let sentCount = 0
      for (const user of users) {
        const [logsRes, balanceRes, clickRes, bonusRes] = await Promise.all([
          db.from('onboarding_email_log').select('user_id, email_kind').eq('user_id', user.id),
          db.from('user_balances').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          db.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          db.from('active_bonuses').select('bonus_pct, from_program_name, to_program_name').limit(1).order('bonus_pct', { ascending: false }),
        ])

        const logs = (logsRes.data ?? []) as EmailLogRow[]
        const already = new Set(logs.map((row) => row.email_kind))
        const hasActivity = (balanceRes.count ?? 0) > 0 || (clickRes.count ?? 0) > 0
        const ageDays = daysSince(user.created_at)

        if (!already.has('welcome')) {
          await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: 'Welcome to PointsMax — start in 2 minutes',
            html: `<p>Welcome to PointsMax.</p><p>Start here: <a href="${appUrl()}/us/how-it-works">${appUrl()}/us/how-it-works</a></p>`,
          })
          await db.from('onboarding_email_log').insert({ user_id: user.id, email: user.email, email_kind: 'welcome' })
          sentCount += 1
          continue
        }

        if (ageDays >= 2 && !hasActivity && !already.has('day2')) {
          await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: 'See what your points are worth today',
            html: `<p>You can unlock value instantly with one run.</p><p>Try the calculator: <a href="${appUrl()}/us/calculator">${appUrl()}/us/calculator</a></p>`,
          })
          await db.from('onboarding_email_log').insert({ user_id: user.id, email: user.email, email_kind: 'day2' })
          sentCount += 1
          continue
        }

        if (ageDays >= 7 && !hasActivity && !already.has('day7')) {
          const topBonus = Array.isArray(bonusRes.data) ? bonusRes.data[0] : null
          const bonusText = topBonus
            ? `${topBonus.from_program_name} → ${topBonus.to_program_name} (+${topBonus.bonus_pct}%)`
            : 'new transfer opportunities'
          await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: 'Don’t miss current transfer bonuses',
            html: `<p>We spotted ${bonusText}.</p><p>Open calculator: <a href="${appUrl()}/us/calculator">${appUrl()}/us/calculator</a></p>`,
          })
          await db.from('onboarding_email_log').insert({ user_id: user.id, email: user.email, email_kind: 'day7' })
          sentCount += 1
        }
      }
      return sentCount
    })

    return {
      ok: true,
      users_considered: users.length,
      emails_sent: sent,
    }
  },
)
