import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { enforceRateLimit } from '@/lib/api-security'
import { getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

export async function POST(request: Request) {
  const rateLimitError = await enforceRateLimit(request, {
    namespace: 'user_ping_ip',
    maxRequests: 30,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const updated = await getDb()
    .update(users)
    .set({ lastSeenAt: new Date().toISOString() })
    .where(eq(users.authId, user.id))
    .returning({ id: users.id })
  if (updated.length === 0) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
