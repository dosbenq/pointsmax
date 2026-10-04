import { NextResponse } from 'next/server'
import { getSessionUser, getUserRowId, type SessionUser } from '@/lib/auth'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Guarded =
  | { ok: true; user: SessionUser; userId: string }
  | { ok: false; response: NextResponse }

/** 401 without a session, 404 without a profile row; otherwise the profile id. */
export async function requireProfile(): Promise<Guarded> {
  const user = await getSessionUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const userId = await getUserRowId(user.id)
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'User record not found' }, { status: 404 }) }
  }
  return { ok: true, user, userId }
}
