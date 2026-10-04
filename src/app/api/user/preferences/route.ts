import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getOrCreateUserRowId, getSessionUser, getUserRowId } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { userPreferences } from '@/lib/db/schema'
import { userPreferencesRequestSchema } from '@/lib/validation'

// GET /api/user/preferences — returns preferences for current user
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserRowId(user.id)
  if (!userId) return NextResponse.json({ preferences: null })

  const [preferences] = await getDb()
    .select(columnsOf(userPreferences))
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  return NextResponse.json({ preferences: preferences ?? null })
}

// POST /api/user/preferences — upserts preferences for current user
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getOrCreateUserRowId(user)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = userPreferencesRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid preferences', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const {
    home_airport,
    preferred_cabin,
    preferred_airlines,
    avoided_airlines,
  } = parsed.data

  const values = {
    homeAirport: home_airport ?? null,
    preferredCabin: preferred_cabin ?? 'any',
    preferredAirlines: preferred_airlines ?? [],
    avoidedAirlines: avoided_airlines ?? [],
    updatedAt: new Date().toISOString(),
  }

  try {
    await getDb()
      .insert(userPreferences)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: userPreferences.userId, set: values })
  } catch (error) {
    console.error('user_preferences_upsert_failed', {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
