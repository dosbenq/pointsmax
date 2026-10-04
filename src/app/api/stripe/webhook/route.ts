import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db/client'
import { creatorConversions, stripeWebhookEvents, subscriptionEvents, users } from '@/lib/db/schema'
import { getStripeWebhookSecret, verifyStripeWebhookSignature } from '@/lib/stripe'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'

export const runtime = 'nodejs'

type StripeEvent = {
  id: string
  type: string
  created?: number
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

async function insertSubscriptionEvent(
  db: Database,
  event: {
    userId?: string | null
    stripeCustomerId?: string | null
    eventType: string
    previousTier?: string | null
    newTier?: string | null
    metadata?: Record<string, unknown>
  },
) {
  await db.insert(subscriptionEvents).values({
    userId: event.userId ?? null,
    stripeCustomerId: event.stripeCustomerId ?? null,
    eventType: event.eventType,
    previousTier: event.previousTier ?? null,
    newTier: event.newTier ?? null,
    metadata: event.metadata ?? null,
  })
}

async function insertCreatorConversion(
  db: Database,
  input: { creatorSlug: string; userId: string | null; revenueUsd?: number | null },
) {
  await db.insert(creatorConversions).values({
    creatorSlug: input.creatorSlug,
    userId: input.userId,
    revenueUsd: input.revenueUsd ?? 999,
  })
}

/** When the Stripe event happened (event.created), falling back to the object. */
function eventTimestamp(event: StripeEvent, object: Record<string, unknown>): string {
  const seconds = typeof event.created === 'number'
    ? event.created
    : typeof object.created === 'number' ? object.created : Date.now() / 1000
  return new Date(seconds * 1000).toISOString()
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
    const db = getDb()
    try {
      const recorded = await db
        .insert(stripeWebhookEvents)
        .values({
          stripeEventId: event.id,
          eventType: event.type,
          rawPayload: event as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing({ target: stripeWebhookEvents.stripeEventId })
        .returning({ id: stripeWebhookEvents.stripeEventId })
      if (recorded.length === 0) {
        logInfo('stripe_webhook_duplicate_skipped', { requestId, event_id: event.id })
        return NextResponse.json({ received: true })
      }
    } catch (idempotencyError) {
      logWarn('stripe_webhook_idempotency_insert_failed', {
        requestId,
        event_id: event.id,
        error: idempotencyError instanceof Error ? idempotencyError.message : String(idempotencyError),
        degraded_safety: true,
      })
    }

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
      // Don't trust client_reference_id as fallback for user identification
      const userId = getString(metadata.user_id)
      if (!userId) {
        logWarn('stripe_webhook_no_user_id', { event_id: event.id, type: event.type })
        return NextResponse.json({ received: true })
      }
      const customerId = getString(object.customer)
      const refSlug = getString(metadata.ref_slug)

      if (userId) {
        const [existingUserRow] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId)).limit(1)
        const previousTier = existingUserRow?.tier === 'premium' ? 'premium' : 'free'

        await db
          .update(users)
          .set({
            tier: 'premium',
            tierUpdatedAt: eventTimestamp(event, object),
            ...(customerId ? { stripeCustomerId: customerId } : {}),
          })
          .where(eq(users.id, userId))

        await insertSubscriptionEvent(db, {
          userId,
          stripeCustomerId: customerId,
          eventType: 'checkout.session.completed',
          previousTier,
          newTier: 'premium',
          metadata: { stripe_customer_id: customerId, ref_slug: refSlug },
        })

        if (refSlug) {
          // Attribution is best-effort: an unknown creator slug must not fail the upgrade.
          try {
            await insertCreatorConversion(db, {
              creatorSlug: refSlug,
              userId,
              revenueUsd: 999,
            })
          } catch (conversionError) {
            logWarn('stripe_webhook_creator_conversion_failed', {
              requestId,
              ref_slug: refSlug,
              error: conversionError instanceof Error ? conversionError.message : String(conversionError),
            })
          }
        }

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
      const [existingUserRow] = await db
        .select({ id: users.id, tier: users.tier })
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
        .limit(1)
      const existingUser = existingUserRow
        ? { id: existingUserRow.id, tier: existingUserRow.tier === 'premium' ? 'premium' : 'free' }
        : null

      const nextTier =
        event.type === 'customer.subscription.deleted'
          ? 'free'
          : isPremiumSubscriptionStatus(status)
            ? 'premium'
            : 'free'

      if (existingUser) {
        // Ignore events older than the one that last set the tier (Stripe can
        // deliver out of order).
        const eventAt = eventTimestamp(event, object)
        try {
          await db
            .update(users)
            .set({ tier: nextTier, tierUpdatedAt: eventAt })
            .where(and(
              eq(users.id, existingUser.id),
              or(isNull(users.tierUpdatedAt), lte(users.tierUpdatedAt, eventAt)),
            ))
        } catch (updateError) {
          logWarn('stripe_webhook_tier_update_failed', {
            requestId,
            customer_id: customerId,
            error: updateError instanceof Error ? updateError.message : String(updateError),
          })
        }
      }

      await insertSubscriptionEvent(db, {
        userId: existingUser?.id ?? null,
        stripeCustomerId: customerId,
        eventType: event.type,
        previousTier: existingUser?.tier === 'premium' ? 'premium' : 'free',
        newTier: nextTier,
        metadata: { stripe_status: status },
      })

      logInfo('stripe_webhook_subscription_synced', {
        requestId,
        customer_id: customerId,
        event_type: event.type,
        tier: nextTier,
      })
    }

    if (event.type === 'invoice.payment_failed') {
      const customerId = getString(object.customer)
      if (customerId) {
        await insertSubscriptionEvent(db, {
          stripeCustomerId: customerId,
          eventType: 'invoice.payment_failed',
          metadata: {
            invoice_id: getString(object.id),
            amount_due: object.amount_due,
          },
        })

        logWarn('stripe_invoice_payment_failed', { requestId, customer_id: customerId })
      }

      return NextResponse.json({ received: true })
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
