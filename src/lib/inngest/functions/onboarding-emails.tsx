import { Resend } from 'resend'
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase'
import { calculateRedemptions } from '@/lib/calculate'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { renderEmail } from '@/lib/email-render'
import { ProUpsellEmail } from '@/emails/ProUpsellEmail'
import { RetentionEmail } from '@/emails/RetentionEmail'
import { WelcomeEmail } from '@/emails/WelcomeEmail'

type UserRow = {
  id: string
  email: string
  tier: 'free' | 'premium'
  last_seen_at: string | null
}

type BalanceRow = {
  program_id: string
  balance: number
}

type ProgramRow = {
  id: string
  name: string
}

type TransferPartnerLookupRow = {
  from_program_id: string
  to_program_id: string
}

export function shouldSendFollowUp(lastSeenAt: string | null, minimumDays: number): boolean {
  if (!lastSeenAt) return true
  const lastSeen = Date.parse(lastSeenAt)
  if (!Number.isFinite(lastSeen)) return true
  return Date.now() - lastSeen >= minimumDays * 24 * 60 * 60 * 1000
}

export function pickLargestProgram(
  balances: BalanceRow[],
  programsById: Map<string, string>,
): { name: string; programId: string } | null {
  const largest = [...balances].sort((left, right) => right.balance - left.balance)[0]
  if (!largest) return null
  return {
    name: programsById.get(largest.program_id) ?? 'your main program',
    programId: largest.program_id,
  }
}

async function logEmailKind(db: ReturnType<typeof createAdminClient>, userId: string, email: string, kind: string) {
  await db.from('onboarding_email_log').upsert({
    user_id: userId,
    email,
    email_kind: kind,
  }, { onConflict: 'user_id,email_kind', ignoreDuplicates: true })
}

export const onboardingEmails = inngest.createFunction(
  { id: 'onboarding-emails', name: 'Growth: Onboarding Emails' },
  { event: 'user.onboarding_completed' },
  async ({ event, step }) => {
    const resendKey = process.env.RESEND_API_KEY?.trim()
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()
    if (!resendKey || !fromEmail) {
      return { ok: false, skipped: true, reason: 'resend_not_configured' }
    }

    const userId = typeof event.data.user_id === 'string' ? event.data.user_id : ''
    if (!userId) {
      return { ok: false, skipped: true, reason: 'missing_user_id' }
    }

    const appOrigin = getConfiguredAppOrigin()
    const region = event.data.region === 'in' ? 'in' : 'us'
    const db = createAdminClient()
    const resend = new Resend(resendKey)

    const user = await step.run('load-user', async () => {
      const { data } = await db.from('users').select('id, email, tier, last_seen_at').eq('id', userId).single()
      return (data ?? null) as UserRow | null
    })
    if (!user?.email) {
      return { ok: false, skipped: true, reason: 'user_not_found' }
    }

    const [{ data: balancesData }, { data: programsData }, { data: transferPartnerData }] = await Promise.all([
      db.from('user_balances').select('program_id, balance').eq('user_id', userId),
      db.from('programs').select('id, name'),
      db.from('transfer_partners').select('from_program_id, to_program_id').eq('is_active', true),
    ])

    const balances = (balancesData ?? []) as BalanceRow[]
    const programs = (programsData ?? []) as ProgramRow[]
    const programsById = new Map(programs.map((program) => [program.id, program.name]))
    const largestProgram = pickLargestProgram(balances, programsById)

    const portfolioValue = balances.length > 0
      ? await step.run('calculate-portfolio-value', async () => {
          const response = await calculateRedemptions(
            balances.map((balance) => ({
              program_id: balance.program_id,
              amount: Math.max(0, Math.round(Number(balance.balance) || 0)),
            })).filter((balance) => balance.amount > 0),
          )
          return `$${(response.total_optimal_value_cents / 100).toLocaleString()}`
        })
      : '$0'

    await step.run('send-welcome-email', async () => {
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: 'Welcome to PointsMax',
          html: await renderEmail(
            <WelcomeEmail
              userEmail={user.email}
              portfolioValue={portfolioValue}
            recommendations={[
              'Check the Value Analyzer to see your floor, likely, and best-case value.',
              'Use Award Search when you already know the route you want to verify.',
              'Save a flight watch once you find a route worth monitoring.',
            ]}
            calculatorUrl={`${appOrigin}/${region}/calculator`}
          />,
        ),
      })
      await logEmailKind(db, userId, user.email, 'event_welcome')
    })

    await step.sleep('wait-3-days', '3d')

    const refreshedUser = await step.run('reload-user-after-3d', async () => {
      const { data } = await db.from('users').select('id, email, tier, last_seen_at').eq('id', userId).single()
      return (data ?? null) as UserRow | null
    })

    if (refreshedUser?.email && shouldSendFollowUp(refreshedUser.last_seen_at, 3)) {
      const transferPartnerName = largestProgram
        ? ((transferPartnerData as TransferPartnerLookupRow[] | null) ?? [])
          .find((row) => row.from_program_id === largestProgram.programId)
        : null
      const bestPartner = transferPartnerName ? programsById.get(transferPartnerName.to_program_id) : null

      await step.run('send-retention-email', async () => {
        await resend.emails.send({
          from: fromEmail,
          to: refreshedUser.email,
          subject: `Your ${largestProgram?.name ?? 'points'} may transfer further`,
          html: await renderEmail(
            <RetentionEmail
              largestProgram={largestProgram?.name ?? 'largest program'}
              bestPartner={bestPartner ?? 'a stronger partner'}
              calculatorUrl={`${appOrigin}/${region}/calculator`}
            />,
          ),
        })
        await logEmailKind(db, userId, refreshedUser.email, 'event_day3')
      })
    }

    await step.sleep('wait-7-days', '4d')

    const premiumCheck = await step.run('reload-user-after-7d', async () => {
      const { data } = await db.from('users').select('id, email, tier, last_seen_at').eq('id', userId).single()
      return (data ?? null) as UserRow | null
    })

    if (premiumCheck?.email && premiumCheck.tier === 'free' && shouldSendFollowUp(premiumCheck.last_seen_at, 7)) {
      const homeAirport = typeof event.data.home_airport === 'string' && event.data.home_airport
        ? event.data.home_airport
        : (region === 'in' ? 'DEL' : 'JFK')

      await step.run('send-premium-upsell-email', async () => {
        await resend.emails.send({
          from: fromEmail,
          to: premiumCheck.email,
          subject: 'Unlock live award availability',
          html: await renderEmail(
            <ProUpsellEmail
              homeAirport={homeAirport}
              pricingUrl={`${appOrigin}/${region}/pricing?utm_source=onboarding_email`}
            />,
          ),
        })
        await logEmailKind(db, userId, premiumCheck.email, 'event_day7')
      })
    }

    return { ok: true, user_id: userId }
  },
)
