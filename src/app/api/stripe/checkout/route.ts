import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  createStripeCheckoutSession,
  createStripeCustomer,
  getSafeAppOrigin,
  getStripeSecretKey,
} from '@/lib/stripe'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'

type UserRow = {
  id: string
  email: string
  tier: 'free' | 'premium'
  stripe_customer_id: string | null
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const secretKey = getStripeSecretKey()

  if (!secretKey) {
    logWarn('stripe_checkout_unconfigured', { requestId })
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
      .select('id, email, tier, stripe_customer_id')
      .eq('auth_id', user.id)
      .single()
    const userRow = (data ?? null) as UserRow | null

    if (userErr || !userRow) {
      logWarn('stripe_checkout_user_missing', {
        requestId,
        auth_user_id: user.id,
        error: userErr?.message ?? null,
      })
      return NextResponse.json({ error: 'Profile not found. Please sign out and sign in again.' }, { status: 404 })
    }

    if (userRow.tier === 'premium') {
      return NextResponse.json({ error: 'You are already on PointsMax Pro.' }, { status: 409 })
    }

    let customerId = userRow.stripe_customer_id
    if (!customerId) {
      const customer = await createStripeCustomer({
        secretKey,
        email: userRow.email,
        userId: userRow.id,
      })
      customerId = customer.id

      const { error: updateErr } = await db
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userRow.id)
      if (updateErr) {
        logWarn('stripe_checkout_customer_id_update_failed', {
          requestId,
          user_id: userRow.id,
          error: updateErr.message,
        })
      }
    }

    const appOrigin = getSafeAppOrigin(req.url)
    const session = await createStripeCheckoutSession({
      secretKey,
      customerId,
      userId: userRow.id,
      successUrl: `${appOrigin}/pricing?checkout=success`,
      cancelUrl: `${appOrigin}/pricing?checkout=cancelled`,
      priceId: process.env.STRIPE_PRO_PRICE_ID,
    })

    logInfo('stripe_checkout_created', {
      requestId,
      user_id: userRow.id,
      session_id: session.id,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    logError('stripe_checkout_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Unable to start checkout right now.' }, { status: 500 })
  }
}
