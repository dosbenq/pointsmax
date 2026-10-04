import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { getOrCreateUserRowId, getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { programs, userBalances, userPreferences } from '@/lib/db/schema'
import { inngest } from '@/lib/inngest/client'
import { logError } from '@/lib/logger'

const IATA_RE = /^[A-Z]{3}$/
const MAX_BALANCE = 100_000_000

type OnboardingBody = {
  region?: unknown
  home_airport?: unknown
  balances?: unknown
}

function parseBalances(raw: unknown): Array<{ program_slug: string; balance: number }> {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      const e = entry as { program_slug?: unknown; balance?: unknown }
      const balance = Math.floor(Number(e.balance))
      if (typeof e.program_slug !== 'string' || !Number.isFinite(balance)) return null
      if (balance <= 0 || balance > MAX_BALANCE) return null
      return { program_slug: e.program_slug, balance }
    })
    .filter((row): row is { program_slug: string; balance: number } => row !== null)
    .slice(0, 10)
}

// POST /api/onboarding/complete
// Body: { region, home_airport?, balances?: [{ program_slug, balance }] }
// Saves the home airport and starting balances, then starts onboarding emails.
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as OnboardingBody
  const region = body.region === 'in' ? 'in' : 'us'
  const airportRaw = typeof body.home_airport === 'string' ? body.home_airport.trim().toUpperCase() : ''
  const homeAirport = IATA_RE.test(airportRaw) ? airportRaw : null
  const balances = parseBalances(body.balances)

  let internalUserId: string
  try {
    internalUserId = await getOrCreateUserRowId(user)
    await getDb().transaction(async (tx) => {
      if (homeAirport) {
        await tx
          .insert(userPreferences)
          .values({ userId: internalUserId, homeAirport })
          .onConflictDoUpdate({
            target: userPreferences.userId,
            set: { homeAirport, updatedAt: new Date().toISOString() },
          })
      }

      if (balances.length > 0) {
        const programRows = await tx
          .select({ id: programs.id, slug: programs.slug })
          .from(programs)
          .where(and(inArray(programs.slug, balances.map((b) => b.program_slug)), eq(programs.isActive, true)))
        const idBySlug = new Map(programRows.map((p) => [p.slug, p.id]))
        const rows = balances
          .filter((b) => idBySlug.has(b.program_slug))
          .map((b) => ({
            userId: internalUserId,
            programId: idBySlug.get(b.program_slug)!,
            balance: b.balance,
            updatedAt: new Date().toISOString(),
          }))
        if (rows.length > 0) {
          await tx
            .insert(userBalances)
            .values(rows)
            .onConflictDoUpdate({
              target: [userBalances.userId, userBalances.programId],
              set: { balance: sql`excluded.balance`, updatedAt: sql`excluded.updated_at` },
            })
        }
      }
    })
  } catch (error) {
    logError('onboarding_complete_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Unable to save onboarding' }, { status: 500 })
  }

  try {
    await inngest.send({
      name: 'user.onboarding_completed',
      data: {
        user_id: internalUserId,
        region,
        home_airport: homeAirport,
      },
    })
  } catch (error) {
    // Emails are best-effort; the user's data is already saved.
    logError('onboarding_event_send_failed', { error: error instanceof Error ? error.message : String(error) })
  }

  return NextResponse.json({ ok: true })
}
