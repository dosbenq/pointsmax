import { Resend } from 'resend'
import { inngest } from '../client'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { desc, eq, gte } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db/client'
import { activeBonuses, affiliateClicks, onboardingEmailLog, userBalances, users as usersTable } from '@/lib/db/schema'

type UserRow = {
  id: string
  email: string
  created_at: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function appUrl(): string {
  return getConfiguredAppOrigin()
}

function daysSince(iso: string): number {
  const created = Date.parse(iso)
  if (!Number.isFinite(created)) return 0
  return Math.floor((Date.now() - created) / MS_PER_DAY)
}

type EmailSender = { emails: { send: (payload: { from: string; to: string; subject: string; html: string }) => Promise<unknown> } }

export async function loadDripCandidates(db: Database, now = Date.now()): Promise<UserRow[]> {
  const threshold = new Date(now - 8 * MS_PER_DAY).toISOString()
  return db
    .select({ id: usersTable.id, email: usersTable.email, created_at: usersTable.createdAt })
    .from(usersTable)
    .where(gte(usersTable.createdAt, threshold))
    .orderBy(desc(usersTable.createdAt))
}

/**
 * Send at most one drip email per user. Users who completed onboarding are
 * handled by the event-driven `onboarding-emails` flow (kinds `event_*`) and
 * are skipped here so they never get two welcome emails.
 */
export async function sendOnboardingDrip(
  db: Database,
  resend: EmailSender,
  fromEmail: string,
  users: UserRow[],
): Promise<number> {
  let sentCount = 0
  for (const user of users) {
    const [logs, balanceCount, clickCount, [topBonus]] = await Promise.all([
      db.select({ email_kind: onboardingEmailLog.emailKind }).from(onboardingEmailLog).where(eq(onboardingEmailLog.userId, user.id)),
      db.$count(userBalances, eq(userBalances.userId, user.id)),
      db.$count(affiliateClicks, eq(affiliateClicks.userId, user.id)),
      db
        .select({
          bonus_pct: activeBonuses.bonusPct,
          from_program_name: activeBonuses.fromProgramName,
          to_program_name: activeBonuses.toProgramName,
        })
        .from(activeBonuses)
        .orderBy(desc(activeBonuses.bonusPct))
        .limit(1),
    ])

    const already = new Set(logs.map((row) => row.email_kind))
    if ([...already].some((kind) => kind.startsWith('event_'))) continue

    const hasActivity = balanceCount > 0 || clickCount > 0
    const ageDays = daysSince(user.created_at)

    const send = async (kind: string, subject: string, html: string) => {
      await resend.emails.send({ from: fromEmail, to: user.email, subject, html })
      await db
        .insert(onboardingEmailLog)
        .values({ userId: user.id, email: user.email, emailKind: kind })
        .onConflictDoNothing()
      sentCount += 1
    }

    if (!already.has('welcome')) {
      await send(
        'welcome',
        'Welcome to PointsMax — start in 2 minutes',
        `<p>Welcome to PointsMax.</p><p>Start here: <a href="${appUrl()}/us/how-it-works">${appUrl()}/us/how-it-works</a></p>`,
      )
      continue
    }

    if (ageDays >= 2 && !hasActivity && !already.has('day2')) {
      await send(
        'day2',
        'See what your points are worth today',
        `<p>You can unlock value instantly with one run.</p><p>Try the calculator: <a href="${appUrl()}/us/calculator">${appUrl()}/us/calculator</a></p>`,
      )
      continue
    }

    if (ageDays >= 7 && !hasActivity && !already.has('day7')) {
      const bonusText = topBonus
        ? `${topBonus.from_program_name} → ${topBonus.to_program_name} (+${topBonus.bonus_pct}%)`
        : 'new transfer opportunities'
      await send(
        'day7',
        'Don’t miss current transfer bonuses',
        `<p>We spotted ${bonusText}.</p><p>Open calculator: <a href="${appUrl()}/us/calculator">${appUrl()}/us/calculator</a></p>`,
      )
    }
  }
  return sentCount
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

    const db = getDb()
    const resend = new Resend(resendKey)

    const users = await step.run('load-recent-users', () => loadDripCandidates(db))
    const sent = await step.run('send-onboarding-sequence', () => sendOnboardingDrip(db, resend, fromEmail, users))

    return {
      ok: true,
      users_considered: users.length,
      emails_sent: sent,
    }
  },
)
