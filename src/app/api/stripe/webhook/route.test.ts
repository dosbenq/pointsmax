import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getStripeWebhookSecret, verifyStripeWebhookSignature } from '@/lib/stripe'

vi.mock('@/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  getStripeWebhookSecret: vi.fn().mockReturnValue('whsec_test'),
  verifyStripeWebhookSignature: vi.fn().mockReturnValue(true),
}))

type MockUser = {
  id: string
  tier: 'free' | 'premium'
  stripe_customer_id: string | null
}

type MockState = {
  processedEventIds: Set<string>
  usersById: Map<string, MockUser>
  subscriptionEvents: Array<Record<string, unknown>>
  updates: Array<Record<string, unknown>>
}

function buildStripeEvent(type: string, object: Record<string, unknown>, id = 'evt_test_1') {
  return {
    id,
    type,
    data: {
      object,
    },
  }
}

function makeRequest(event: Record<string, unknown>) {
  return new NextRequest('https://pointsmax.com/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 't=123,v1=sig',
    },
    body: JSON.stringify(event),
  })
}

function findUserByCustomer(state: MockState, customerId: string) {
  for (const user of state.usersById.values()) {
    if (user.stripe_customer_id === customerId) return user
  }
  return null
}

function createDbMock(state: MockState) {
  return {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          if (table === 'stripe_webhook_events') {
            const eventId = String(payload.stripe_event_id)
            if (state.processedEventIds.has(eventId)) {
              return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } })
            }
            state.processedEventIds.add(eventId)
            return Promise.resolve({ error: null })
          }

          if (table === 'subscription_events') {
            state.subscriptionEvents.push(payload)
            return Promise.resolve({ error: null })
          }

          return Promise.resolve({ error: null })
        },
        update(payload: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              state.updates.push({ table, payload, column, value })
              if (table === 'users') {
                if (column === 'id') {
                  const user = state.usersById.get(value)
                  if (user) {
                    Object.assign(user, payload)
                  }
                } else if (column === 'stripe_customer_id') {
                  const user = findUserByCustomer(state, value)
                  if (user) {
                    Object.assign(user, payload)
                  }
                }
              }
              return Promise.resolve({ error: null })
            },
          }
        },
        select() {
          return {
            eq(column: string, value: string) {
              return {
                single: async () => {
                  if (table !== 'users') {
                    return { data: null, error: null }
                  }

                  if (column === 'id') {
                    return { data: state.usersById.get(value) ?? null, error: null }
                  }

                  if (column === 'stripe_customer_id') {
                    return { data: findUserByCustomer(state, value), error: null }
                  }

                  return { data: null, error: null }
                },
              }
            },
          }
        },
      }
    },
  }
}

const { POST } = await import('./route')

describe('POST /api/stripe/webhook', () => {
  let state: MockState

  beforeEach(() => {
    vi.clearAllMocks()
    state = {
      processedEventIds: new Set(),
      usersById: new Map([
        ['user-1', { id: 'user-1', tier: 'free', stripe_customer_id: null }],
        ['user-2', { id: 'user-2', tier: 'premium', stripe_customer_id: 'cus_premium' }],
      ]),
      subscriptionEvents: [],
      updates: [],
    }
    vi.mocked(createAdminClient).mockReturnValue(createDbMock(state) as never)
    vi.mocked(getStripeWebhookSecret).mockReturnValue('whsec_test')
    vi.mocked(verifyStripeWebhookSignature).mockReturnValue(true)
  })

  it('upgrades a user on checkout.session.completed', async () => {
    const res = await POST(makeRequest(buildStripeEvent('checkout.session.completed', {
      mode: 'subscription',
      customer: 'cus_new',
      client_reference_id: 'user-1',
      metadata: { user_id: 'user-1' },
    })))

    expect(res.status).toBe(200)
    expect(state.usersById.get('user-1')?.tier).toBe('premium')
    expect(state.usersById.get('user-1')?.stripe_customer_id).toBe('cus_new')
    expect(state.subscriptionEvents).toHaveLength(1)
    expect(state.subscriptionEvents[0].event_type).toBe('checkout.session.completed')
  })

  it('downgrades a user on customer.subscription.deleted', async () => {
    const res = await POST(makeRequest(buildStripeEvent('customer.subscription.deleted', {
      customer: 'cus_premium',
      status: 'canceled',
    }, 'evt_sub_deleted')))

    expect(res.status).toBe(200)
    expect(state.usersById.get('user-2')?.tier).toBe('free')
    expect(state.subscriptionEvents).toHaveLength(1)
    expect(state.subscriptionEvents[0].event_type).toBe('customer.subscription.deleted')
  })

  it('skips duplicate event ids without reprocessing', async () => {
    const event = buildStripeEvent('checkout.session.completed', {
      mode: 'subscription',
      customer: 'cus_new',
      client_reference_id: 'user-1',
      metadata: { user_id: 'user-1' },
    }, 'evt_duplicate')

    const first = await POST(makeRequest(event))
    const second = await POST(makeRequest(event))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(state.subscriptionEvents).toHaveLength(1)
    expect(state.updates).toHaveLength(1)
  })

  it('logs invoice.payment_failed without changing the user tier', async () => {
    const res = await POST(makeRequest(buildStripeEvent('invoice.payment_failed', {
      id: 'in_123',
      customer: 'cus_premium',
      amount_due: 999,
      billing_reason: 'subscription_cycle',
    }, 'evt_invoice_failed')))

    expect(res.status).toBe(200)
    expect(state.usersById.get('user-2')?.tier).toBe('premium')
    expect(state.subscriptionEvents).toHaveLength(1)
    expect(state.subscriptionEvents[0].event_type).toBe('invoice.payment_failed')
    expect(state.updates).toHaveLength(0)
  })

  it('rejects invalid signatures before any db writes', async () => {
    vi.mocked(verifyStripeWebhookSignature).mockReturnValue(false)

    const res = await POST(makeRequest(buildStripeEvent('checkout.session.completed', {
      mode: 'subscription',
      customer: 'cus_new',
      metadata: { user_id: 'user-1' },
    })))

    expect(res.status).toBe(400)
    expect(state.subscriptionEvents).toHaveLength(0)
    expect(state.updates).toHaveLength(0)
    expect(state.processedEventIds.size).toBe(0)
  })
})
