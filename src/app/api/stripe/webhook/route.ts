import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getStripeWebhookSecret, verifyStripeWebhookSignature } from '@/lib/stripe'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'

export const runtime = 'nodejs'

type StripeEvent = {
  type: string
  data?: {
    object?: Record<string, unknown>
  }
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isPremiumSubscriptionStatus(status: string | null): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const webhookSecret = getStripeWebhookSecret()

  if (!webhookSecret) {
    logWarn('stripe_webhook_unconfigured', { requestId })
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const signatureHeader = req.headers.get('stripe-signature')
  const payload = await req.text()

  const isValid = verifyStripeWebhookSignature({
    payload,
    signatureHeader,
    webhookSecret,
  })

  if (!isValid) {
    logWarn('stripe_webhook_signature_invalid', { requestId })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(payload) as StripeEvent
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    const db = createAdminClient()
    const object = event.data?.object

    if (!isRecord(object)) {
      return NextResponse.json({ received: true })
    }

    if (event.type === 'checkout.session.completed') {
      const mode = getString(object.mode)
      if (mode !== 'subscription') {
        return NextResponse.json({ received: true })
      }

      const metadata = isRecord(object.metadata) ? object.metadata : {}
      const userId = getString(metadata.user_id) ?? getString(object.client_reference_id)
      const customerId = getString(object.customer)

      if (userId) {
        await db
          .from('users')
          .update({
            tier: 'premium',
            stripe_customer_id: customerId ?? undefined,
          })
          .eq('id', userId)
        logInfo('stripe_webhook_checkout_completed', { requestId, user_id: userId })
      }

      return NextResponse.json({ received: true })
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const customerId = getString(object.customer)
      if (!customerId) {
        return NextResponse.json({ received: true })
      }

      const status = getString(object.status)
      const nextTier =
        event.type === 'customer.subscription.deleted'
          ? 'free'
          : isPremiumSubscriptionStatus(status)
            ? 'premium'
            : 'free'

      await db
        .from('users')
        .update({ tier: nextTier })
        .eq('stripe_customer_id', customerId)

      logInfo('stripe_webhook_subscription_synced', {
        requestId,
        customer_id: customerId,
        event_type: event.type,
        tier: nextTier,
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logError('stripe_webhook_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      event_type: event.type,
    })
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 500 })
  }
}

