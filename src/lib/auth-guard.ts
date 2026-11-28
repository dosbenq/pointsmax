import { NextResponse } from 'next/server'
import { getSessionUser, getUserRowId, type SessionUser } from '@/lib/auth'
import { DatabaseNotReadyError, ensureDatabaseReady } from '@/lib/db/ready'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Guarded =
  | { ok: true; user: SessionUser; userId: string }
  | { ok: false; response: NextResponse }

export function databaseNotReadyResponse(): NextResponse {
  return NextResponse.json({ error: 'Temporarily unavailable, please retry shortly' }, { status: 503, headers: { 'Retry-After': '30' } })
}

type SessionGuarded =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse }

/** 503 while the database is not ready, 401 without a session; otherwise the signed-in user. */
export async function requireSession(): Promise<SessionGuarded> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    return { ok: true, user }
  } catch (error) {
    if (error instanceof DatabaseNotReadyError) return { ok: false, response: databaseNotReadyResponse() }
    throw error
  }
}

/** 503 while the database is not ready, 401 without a session, 404 without a profile row. */
export async function requireProfile(): Promise<Guarded> {
  const session = await requireSession()
  if (!session.ok) return session
  const { user } = session
  const userId = await getUserRowId(user.id)
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'User record not found' }, { status: 404 }) }
  }
  return { ok: true, user, userId }
}

/** For routes that write user data without requiring sign-in: a 503 response while the database is not ready, else null. */
export async function databaseUnavailable(): Promise<NextResponse | null> {
  try {
    await ensureDatabaseReady()
    return null
  } catch {
    return databaseNotReadyResponse()
  }
}
