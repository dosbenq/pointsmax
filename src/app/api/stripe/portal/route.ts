import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createStripeBillingPortalSession, getSafeAppOrigin, getStripeSecretKey } from '@/lib/stripe'
import { getRequestId, logError, logWarn } from '@/lib/logger'

type UserRow = {
  id: string
  stripe_customer_id: string | null
}

async function openPortal(req: NextRequest) {
  const requestId = getRequestId(req)
  const secretKey = getStripeSecretKey()

  if (!secretKey) {
    return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 503 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  try {
    const db = createAdminClient()
    const { data, error: userErr } = await db
      .from('users')
      .select('id, stripe_customer_id')
      .eq('auth_id', user.id)
      .single()
    const userRow = (data ?? null) as UserRow | null

    if (userErr || !userRow) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    }

    if (!userRow.stripe_customer_id) {
      logWarn('stripe_portal_missing_customer', { requestId, user_id: userRow.id })
      return NextResponse.json({ error: 'No active billing profile found.' }, { status: 400 })
    }

    const appOrigin = getSafeAppOrigin(req.url)
    const session = await createStripeBillingPortalSession({
      secretKey,
      customerId: userRow.stripe_customer_id,
      returnUrl: `${appOrigin}/pricing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    logError('stripe_portal_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Unable to open billing portal right now.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return openPortal(req)
}

// GET method removed for security - use POST only
