import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'
import { createAdminClient } from './supabase'
import { enforceRateLimit } from './api-security'
import { isServerAdminEmail } from './admin-emails'

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
export async function requireAdmin(req: Request): Promise<{ error: NextResponse | null; adminEmail?: string }> {
  const rateLimitError = await enforceRateLimit(req, ADMIN_RATE_LIMIT)
  if (rateLimitError) return { error: rateLimitError }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const emailVerified = Boolean(user?.email_confirmed_at)
  if (!user || !emailVerified || !isServerAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { error: null, adminEmail: user.email! }
}

export async function logAdminAction(
  action: string,
  targetId: string | null,
  payload: Record<string, unknown>,
  adminEmail: string,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('admin_audit_log').insert({
      admin_email: adminEmail,
      action,
      target_id: targetId,
      payload,
    } as never)
  } catch (err) {
    console.error('[admin-audit] Failed to log action:', action, err)
  }
}
