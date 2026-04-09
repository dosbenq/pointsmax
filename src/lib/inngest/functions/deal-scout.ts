import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase'
import { Resend } from 'resend'
import { AwardProviderUnavailableError, createAwardProvider } from '@/lib/award-search'
import { StubProvider } from '@/lib/award-search/stub-provider'
import type { CabinClass } from '@/lib/award-search/types'
import type { AwardProvider } from '@/lib/award-search'
import { loadUnifiedBalancesByUser } from '@/lib/user-balances'
import { scoreDeal } from '@/lib/deal-scorer'

type WatchRow = {
  id: string
  user_id: string
  origin: string
  destination: string
  cabin: string
  start_date: string
  end_date: string
  max_points: number | null
  last_checked_at: string | null
  users: unknown
}

function normalizeWatchRow(value: unknown): WatchRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string'
    || typeof row.user_id !== 'string'
    || typeof row.origin !== 'string'
    || typeof row.destination !== 'string'
    || typeof row.cabin !== 'string'
    || typeof row.start_date !== 'string'
    || typeof row.end_date !== 'string'
  ) {
    return null
  }
  const maxPoints = typeof row.max_points === 'number' ? row.max_points : null
  const lastChecked = typeof row.last_checked_at === 'string' ? row.last_checked_at : null
  return {
    id: row.id,
    user_id: row.user_id,
    origin: row.origin,
    destination: row.destination,
    cabin: row.cabin,
    start_date: row.start_date,
    end_date: row.end_date,
    max_points: maxPoints,
    last_checked_at: lastChecked,
    users: row.users,
  }
}

/**
 * The Deal Scout Agent
 * Periodic background worker that checks award availability for user "watches".
 */
export const dealScout = inngest.createFunction(
  { id: 'deal-scout', name: 'Agent: Deal Scout' },
  { cron: '0 * * * *' }, // Run every hour
  async ({ step }) => {
    const db = createAdminClient()
    const now = Date.now()
    const cutoffMs = now - (60 * 60 * 1000)

    // 1) Fetch active watches; we'll enforce "older than 1 hour" in-memory.
    const { data: watches } = await db
      .from('flight_watches')
      .select(`
        id,
        user_id,
        origin,
        destination,
        cabin,
        start_date,
        end_date,
        max_points,
        last_checked_at,
        users(email)
      `)
      .eq("is_active", true)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(200)

    const normalizedWatches = ((watches ?? []) as unknown[])
      .map(normalizeWatchRow)
      .filter((watch): watch is WatchRow => watch !== null)

    if (!normalizedWatches.length) {
      return { message: 'No active watches to check' }
    }

    const dueWatches = normalizedWatches
      .filter((watch) => {
        const lastChecked = typeof watch.last_checked_at === 'string'
          ? Date.parse(watch.last_checked_at)
          : NaN
        if (Number.isNaN(lastChecked)) return true
        return lastChecked <= cutoffMs
      })
      .slice(0, 50)

    if (dueWatches.length === 0) {
      return { message: 'No due watches in this cycle' }
    }

    const uniqueUserIds = [...new Set(dueWatches.map((watch) => watch.user_id))]
    const balancesByUser = new Map<string, Array<{ program_id: string; amount: number }>>()
    const unifiedBalancesByUser = await loadUnifiedBalancesByUser(db, uniqueUserIds)
    for (const [userId, balances] of unifiedBalancesByUser.entries()) {
      balancesByUser.set(
        userId,
        balances
          .map((balance) => ({
            program_id: balance.program_id,
            amount: Math.max(0, Math.round(Number(balance.balance) || 0)),
          }))
          .filter((balance) => balance.amount > 0),
      )
    }

    let provider: AwardProvider = new StubProvider()
    let providerName: 'stub' | 'seats_aero' = provider.name
    let estimatesOnly = provider.name === 'stub'
    try {
      provider = createAwardProvider()
      providerName = provider.name
      estimatesOnly = provider.name === 'stub'
    } catch (error) {
      if (error instanceof AwardProviderUnavailableError) {
        provider = new StubProvider()
        providerName = provider.name
        estimatesOnly = true
      } else {
        throw error
      }
    }

    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL
    const canSendEmail = !!resendKey && !!fromEmail
    const resend = canSendEmail ? new Resend(resendKey) : null

    const results: Array<{
      watch_id: string
      status: 'alerted' | 'no_match' | 'missing_balances' | 'missing_email' | 'send_disabled' | 'search_failed' | 'below_threshold'
      detail?: string
    }> = []

    for (const watch of dueWatches) {
      const userBalances = balancesByUser.get(watch.user_id) ?? []
      if (userBalances.length === 0) {
        results.push({ watch_id: watch.id, status: 'missing_balances' })
        await step.run(`update-watch-${watch.id}-missing_balances`, async () => {
          await db
            .from('flight_watches')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', watch.id)
        })
        continue
      }

      const cabin = normalizeCabin(watch.cabin)
      if (!cabin) {
        results.push({ watch_id: watch.id, status: 'search_failed', detail: 'invalid_cabin' })
        continue
      }

      let searchResults: Awaited<ReturnType<typeof provider.search>>
      try {
        searchResults = await step.run(`check-availability-${watch.id}`, async () => {
          return provider.search(
            {
              origin: watch.origin,
              destination: watch.destination,
              cabin,
              passengers: 1,
              start_date: watch.start_date,
              end_date: watch.end_date,
              balances: userBalances,
            },
            db,
          )
        })
      } catch {
        results.push({ watch_id: watch.id, status: 'search_failed' })
        await step.run(`update-watch-${watch.id}-search_failed`, async () => {
          await db
            .from('flight_watches')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', watch.id)
        })
        continue
      }

      const maxPoints = typeof watch.max_points === 'number' && watch.max_points > 0
        ? watch.max_points
        : null

      const bestDeal = searchResults.find((option) => (
        option.is_reachable
        && option.has_real_availability
        && (maxPoints == null || option.points_needed_from_wallet <= maxPoints)
      ))

      if (!bestDeal) {
        results.push({ watch_id: watch.id, status: 'no_match' })
        await step.run(`update-watch-${watch.id}-no_match`, async () => {
          await db
            .from('flight_watches')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', watch.id)
        })
        continue
      }

      const dealScore = scoreDeal(bestDeal, bestDeal.baseline_cpp_cents)
      if (dealScore.rating === 'fair' || dealScore.rating === 'poor') {
        results.push({ watch_id: watch.id, status: 'below_threshold', detail: dealScore.rating })
        await step.run(`update-watch-${watch.id}-below_threshold`, async () => {
          await db
            .from('flight_watches')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', watch.id)
        })
        continue
      }

      const userEmail = getWatchEmail(watch.users)
      if (!userEmail) {
        results.push({ watch_id: watch.id, status: 'missing_email' })
      } else if (!canSendEmail || !resend) {
        results.push({ watch_id: watch.id, status: 'send_disabled' })
      } else {
        await step.run(`notify-user-${watch.id}`, async () => {
          await resend.emails.send({
            from: fromEmail!,
            to: userEmail,
            subject: dealScore.headline,
            html: `
              <h2>We found a match for your watch.</h2>
              <p><strong>Route:</strong> ${watch.origin} to ${watch.destination}</p>
              <p><strong>Program:</strong> ${bestDeal.program_name}</p>
              <p><strong>Estimated miles:</strong> ${bestDeal.estimated_miles.toLocaleString()}</p>
              <p><strong>Points needed from wallet:</strong> ${bestDeal.points_needed_from_wallet.toLocaleString()}</p>
              <p><strong>Deal rating:</strong> ${dealScore.rating}</p>
              <p><strong>Value:</strong> ${dealScore.cpp_cents.toFixed(1)}¢/pt (${dealScore.vs_static_baseline_pct}% of typical value)</p>
              <p><strong>Travel date:</strong> ${bestDeal.availability?.date ?? watch.start_date}</p>
              <p><a href="${bestDeal.deep_link.url}" style="background:#0f172a;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Open booking link</a></p>
            `,
          })
        })
        results.push({ watch_id: watch.id, status: 'alerted' })
      }

      await step.run(`update-watch-${watch.id}-success`, async () => {
        await db
          .from('flight_watches')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', watch.id)
      })
    }

    return {
      message: 'Deal scout run complete',
      provider: providerName,
      estimates_only: estimatesOnly,
      processed: dueWatches.length,
      deals_found: results.filter((row) => row.status === 'alerted').length,
      results,
    }
  },
)

function normalizeCabin(value: string): CabinClass | null {
  if (value === 'economy' || value === 'premium_economy' || value === 'business' || value === 'first') {
    return value
  }
  return null
}

function getWatchEmail(value: unknown): string | null {
  if (value && typeof value === 'object' && 'email' in value) {
    const email = (value as { email?: unknown }).email
    return typeof email === 'string' && email.includes('@') ? email : null
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]
    if (first && typeof first === 'object' && 'email' in first) {
      const email = (first as { email?: unknown }).email
      return typeof email === 'string' && email.includes('@') ? email : null
    }
  }
  return null
}
