import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
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

const CREATOR_REF_COOKIE = 'pm_creator_ref'

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const secretKey = getStripeSecretKey()

  if (!secretKey) {
    logWarn('stripe_checkout_unconfigured', { requestId })
    return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 503 })
  }

  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    // No body is fine — default to US region
  }
  const normalizedRegion = body.region === 'in' ? 'in' : 'us'

  try {
    const db = getDb()
    const [userRow] = await db
      .select({ id: users.id, email: users.email, tier: users.tier, stripe_customer_id: users.stripeCustomerId })
      .from(users)
      .where(eq(users.authId, user.id))
      .limit(1) as UserRow[]

    if (!userRow) {
      logWarn('stripe_checkout_user_missing', {
        requestId,
        auth_user_id: user.id,
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

      try {
        await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userRow.id))
      } catch (updateErr) {
        logWarn('stripe_checkout_customer_id_update_failed', {
          requestId,
          user_id: userRow.id,
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        })
      }
    }

    const appOrigin = getSafeAppOrigin(req.url)
    const refSlug = req.cookies.get(CREATOR_REF_COOKIE)?.value ?? null
    const priceId = normalizedRegion === 'in'
      ? process.env.STRIPE_PRO_PRICE_ID_INR ?? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_PRO_PRICE_ID
    const session = await createStripeCheckoutSession({
      secretKey,
      customerId,
      userId: userRow.id,
      successUrl: `${appOrigin}/pricing?checkout=success`,
      cancelUrl: `${appOrigin}/pricing?checkout=cancelled`,
      priceId,
      refSlug,
      region: normalizedRegion,
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
