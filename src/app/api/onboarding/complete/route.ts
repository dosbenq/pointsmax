import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getOrCreateUserRowId } from '@/lib/auth'
import { requireSession } from '@/lib/auth-guard'
import { getCatalogProgramBySlug } from '@/lib/catalog'
import { getDb } from '@/lib/db/client'
import { userBalances, userPreferences } from '@/lib/db/schema'
import { logError } from '@/lib/logger'
import { captureServerEvent } from '@/lib/posthog-server'

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
// Saves the home airport and starting balances for the signed-in user.
export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) return session.response
  const { user } = session

  const body = await req.json().catch(() => ({})) as OnboardingBody
  const region = body.region === 'in' ? 'in' : 'us'
  const airportRaw = typeof body.home_airport === 'string' ? body.home_airport.trim().toUpperCase() : ''
  const homeAirport = IATA_RE.test(airportRaw) ? airportRaw : null

  // Programs are catalog data; ignore slugs that are unknown or inactive.
  const balanceRows = parseBalances(body.balances).flatMap((entry) => {
    const program = getCatalogProgramBySlug(entry.program_slug)
    return program?.is_active ? [{ programId: program.id, balance: entry.balance }] : []
  })

  let internalUserId: string
  try {
    internalUserId = await getOrCreateUserRowId(user)
    const now = new Date().toISOString()
    await getDb().transaction(async (tx) => {
      if (homeAirport) {
        await tx
          .insert(userPreferences)
          .values({ userId: internalUserId, homeAirport })
          .onConflictDoUpdate({ target: userPreferences.userId, set: { homeAirport, updatedAt: now } })
      }
      if (balanceRows.length > 0) {
        await tx
          .insert(userBalances)
          .values(balanceRows.map((row) => ({ userId: internalUserId, ...row, updatedAt: now })))
          .onConflictDoUpdate({
            target: [userBalances.userId, userBalances.programId],
            set: { balance: sql`excluded.balance`, updatedAt: sql`excluded.updated_at` },
          })
      }
    })
  } catch (error) {
    logError('onboarding_complete_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Unable to save onboarding' }, { status: 500 })
  }

  await captureServerEvent({
    distinctId: internalUserId,
    event: 'onboarding_completed',
    properties: { region, home_airport: homeAirport, balances_saved: balanceRows.length },
    setPersonProperties: { region, ...(homeAirport ? { home_airport: homeAirport } : {}) },
  })

  return NextResponse.json({ ok: true })
}
