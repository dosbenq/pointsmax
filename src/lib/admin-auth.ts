import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'
import { createAdminClient } from './supabase'
import { enforceRateLimit } from './api-security'
import { getAllowedAdminEmailsForServer, isServerAdminEmail } from './admin-emails'

const ADMIN_RATE_LIMIT = {
  namespace: 'admin_route_ip',
  maxRequests: 20,
  windowMs: 60 * 1000,
} as const

/**
 * Call at the top of every admin API route.
 * Returns a 403/429 NextResponse if the request is not authorized,
 * or null if the check passes.
 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const rateLimitError = await enforceRateLimit(req, ADMIN_RATE_LIMIT)
  if (rateLimitError) return rateLimitError

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const emailVerified = Boolean(user?.email_confirmed_at)
  if (!user || !emailVerified || !isServerAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function logAdminAction(
  action: string,
  targetId: string | null,
  payload?: Record<string, unknown> | null,
  adminEmail?: string | null,
): Promise<void> {
  try {
    const db = createAdminClient()
    const fallbackAdmin = getAllowedAdminEmailsForServer()[0] ?? 'unknown'
    const resolvedEmail = (adminEmail ?? fallbackAdmin).trim() || 'unknown'
    await db.from('admin_audit_log').insert({
      admin_email: resolvedEmail,
      action,
      target_id: targetId,
      payload: payload ?? {},
    } as never)
  } catch {
    // Never block admin flows on audit logging failures.
  }
}
