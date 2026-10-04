import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { logError } from '@/lib/logger'

// GET /api/user/me — the signed-in user's profile row (id, email, tier).
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [record] = await getDb()
      .select({ id: users.id, email: users.email, tier: users.tier })
      .from(users)
      .where(eq(users.authId, user.id))
      .limit(1)
    return NextResponse.json({ user: record ?? null })
  } catch (error) {
    logError('user_me_fetch_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
