// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { setDbForTesting } from '@/lib/db/client'
import { stripeWebhookEvents, subscriptionEvents, users } from '@/lib/db/schema'
import { verifyStripeWebhookSignature } from '@/lib/stripe'
import { createTestDb, seedUser, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { POST } from './route'

const { captureServerEventMock } = vi.hoisted(() => ({ captureServerEventMock: vi.fn() }))

vi.mock('@/lib/posthog-server', () => ({ captureServerEvent: captureServerEventMock }))
vi.mock('@/config/analytics', () => ({ isPosthogConfigured: () => true }))
vi.mock('@/lib/stripe', () => ({
  getStripeWebhookSecret: vi.fn().mockReturnValue('whsec_test'),
  verifyStripeWebhookSignature: vi.fn().mockReturnValue(true),
}))

let db: TestDb
let pat: SeededUser

function stripeEvent(type: string, object: Record<string, unknown>, id: string, created?: number) {
  return { id, type, ...(created ? { created } : {}), data: { object } }
}

function send(event: Record<string, unknown>) {
  return POST(new NextRequest('https://pointsmax.com/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=123,v1=sig' },
    body: JSON.stringify(event),
  }))
}

const tierOf = async (userId: string) =>
  (await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId)))[0]?.tier

beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(verifyStripeWebhookSignature).mockReturnValue(true)
  db = await createTestDb()
  setDbForTesting(db)
  pat = await seedUser(db, 'pat')
})

afterAll(() => setDbForTesting(null))

describe('POST /api/stripe/webhook', () => {
  it('upgrades a user on checkout.session.completed and stores their Stripe customer', async () => {
    const res = await send(stripeEvent('checkout.session.completed', {
      mode: 'subscription', customer: 'cus_123', metadata: { user_id: pat.userId },
    }, 'evt_1', 1_790_000_000))

    expect(res.status).toBe(200)
    const [row] = await db.select().from(users).where(eq(users.id, pat.userId))
    expect(row).toMatchObject({ tier: 'premium', stripeCustomerId: 'cus_123' })
    expect(await db.select().from(subscriptionEvents)).toEqual([
      expect.objectContaining({ userId: pat.userId, previousTier: 'free', newTier: 'premium' }),
    ])
  })

  it('downgrades a user on customer.subscription.deleted', async () => {
    await db.update(users).set({ tier: 'premium', stripeCustomerId: 'cus_123' }).where(eq(users.id, pat.userId))

    const res = await send(stripeEvent('customer.subscription.deleted', {
      customer: 'cus_123', status: 'canceled', created: 1_780_000_000,
    }, 'evt_2', 1_790_000_100))

    expect(res.status).toBe(200)
    expect(await tierOf(pat.userId)).toBe('free')
    expect(await db.select().from(subscriptionEvents)).toEqual([
      expect.objectContaining({ userId: pat.userId, previousTier: 'premium', newTier: 'free' }),
    ])
  })

  it('ignores an older subscription event delivered after a newer one', async () => {
    await db.update(users).set({ stripeCustomerId: 'cus_123' }).where(eq(users.id, pat.userId))
    const sub = { customer: 'cus_123', created: 1_780_000_000 }

    await send(stripeEvent('customer.subscription.deleted', { ...sub, status: 'canceled' }, 'evt_new', 1_790_000_200))
    await send(stripeEvent('customer.subscription.updated', { ...sub, status: 'active' }, 'evt_old', 1_790_000_100))

    expect(await tierOf(pat.userId)).toBe('free')
  })

  it('skips duplicate event ids without reprocessing', async () => {
    const event = stripeEvent('checkout.session.completed', {
      mode: 'subscription', customer: 'cus_123', metadata: { user_id: pat.userId },
    }, 'evt_dup')
    await send(event)
    await send(event)

    expect(await db.select().from(stripeWebhookEvents)).toHaveLength(1)
    expect(await db.select().from(subscriptionEvents)).toHaveLength(1)
  })

  it('processes a retry after a failed attempt instead of skipping it as a duplicate', async () => {
    captureServerEventMock.mockRejectedValueOnce(new Error('analytics down'))
    const event = stripeEvent('checkout.session.completed', {
      mode: 'subscription', customer: 'cus_123', metadata: { user_id: pat.userId },
    }, 'evt_retry')

    expect((await send(event)).status).toBe(500)
    expect(await db.select().from(stripeWebhookEvents)).toHaveLength(0)

    expect((await send(event)).status).toBe(200)
    expect(await tierOf(pat.userId)).toBe('premium')
    expect(await db.select().from(stripeWebhookEvents)).toHaveLength(1)
  })

  it('logs invoice.payment_failed without changing the user tier', async () => {
    await db.update(users).set({ tier: 'premium', stripeCustomerId: 'cus_123' }).where(eq(users.id, pat.userId))
    await send(stripeEvent('invoice.payment_failed', { id: 'in_1', customer: 'cus_123', amount_due: 999 }, 'evt_inv'))

    expect(await tierOf(pat.userId)).toBe('premium')
    expect(await db.select().from(subscriptionEvents)).toEqual([
      expect.objectContaining({ eventType: 'invoice.payment_failed', stripeCustomerId: 'cus_123' }),
    ])
  })

  it('rejects invalid signatures before any db writes', async () => {
    vi.mocked(verifyStripeWebhookSignature).mockReturnValue(false)
    const res = await send(stripeEvent('checkout.session.completed', { mode: 'subscription' }, 'evt_bad'))
    expect(res.status).toBe(400)
    expect(await db.select().from(stripeWebhookEvents)).toHaveLength(0)
  })

  describe('product analytics', () => {
    it('records subscription_started for the paying user, keyed by the Stripe event', async () => {
      await send(stripeEvent('checkout.session.completed', {
        mode: 'subscription',
        customer: 'cus_new',
        amount_total: 999,
        currency: 'usd',
        metadata: { user_id: pat.userId },
      }, 'evt_checkout_analytics'))

      expect(captureServerEventMock).toHaveBeenCalledWith({
        distinctId: pat.userId,
        event: 'subscription_started',
        properties: {
          stripe_event_type: 'checkout.session.completed',
          previous_tier: 'free',
          amount: 9.99,
          currency: 'usd',
        },
        setPersonProperties: { tier: 'premium' },
        dedupeKey: 'stripe:evt_checkout_analytics',
      })
    })

    it("records subscription_canceled and payment_failed against the customer's user", async () => {
      await db.update(users).set({ tier: 'premium', stripeCustomerId: 'cus_premium' }).where(eq(users.id, pat.userId))
      await send(stripeEvent('customer.subscription.deleted', {
        customer: 'cus_premium', status: 'canceled', created: Math.floor(Date.now() / 1000),
      }, 'evt_cancel_analytics'))
      await send(stripeEvent('invoice.payment_failed', {
        id: 'in_1', customer: 'cus_premium', amount_due: 999, currency: 'usd',
      }, 'evt_failed_analytics'))

      expect(captureServerEventMock).toHaveBeenCalledWith(expect.objectContaining({
        distinctId: pat.userId,
        event: 'subscription_canceled',
        setPersonProperties: { tier: 'free' },
        dedupeKey: 'stripe:evt_cancel_analytics',
      }))
      expect(captureServerEventMock).toHaveBeenCalledWith(expect.objectContaining({
        distinctId: pat.userId,
        event: 'payment_failed',
        properties: { stripe_event_type: 'invoice.payment_failed', amount_due: 9.99, currency: 'usd' },
        dedupeKey: 'stripe:evt_failed_analytics',
      }))
    })

    it('sends nothing for subscription updates', async () => {
      await db.update(users).set({ stripeCustomerId: 'cus_premium' }).where(eq(users.id, pat.userId))
      await send(stripeEvent('customer.subscription.updated', {
        customer: 'cus_premium', status: 'active', created: Math.floor(Date.now() / 1000),
      }, 'evt_update_analytics'))

      expect(captureServerEventMock).not.toHaveBeenCalled()
    })
  })
})
