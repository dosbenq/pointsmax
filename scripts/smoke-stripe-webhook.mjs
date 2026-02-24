#!/usr/bin/env node
import { createHmac, randomUUID } from 'node:crypto'

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      out[key] = '1'
      continue
    }
    out[key] = next
    i++
  }
  return out
}

function buildEvent(mode, userId, customerId, status) {
  const base = {
    id: `evt_${randomUUID().replace(/-/g, '')}`,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  }

  if (mode === 'checkout') {
    if (!userId) {
      throw new Error('--user-id is required when --mode checkout')
    }
    return {
      ...base,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_test_${randomUUID().replace(/-/g, '')}`,
          object: 'checkout.session',
          mode: 'subscription',
          customer: customerId || `cus_test_${randomUUID().replace(/-/g, '')}`,
          client_reference_id: userId,
          metadata: { user_id: userId },
        },
      },
    }
  }

  if (mode === 'subscription') {
    if (!customerId) {
      throw new Error('--customer-id is required when --mode subscription')
    }
    return {
      ...base,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: `sub_test_${randomUUID().replace(/-/g, '')}`,
          object: 'subscription',
          customer: customerId,
          status: status || 'active',
          metadata: userId ? { user_id: userId } : {},
        },
      },
    }
  }

  throw new Error(`Unsupported mode "${mode}". Use checkout or subscription.`)
}

function signPayload(payload, webhookSecret) {
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', webhookSecret)
    .update(`${ts}.${payload}`, 'utf8')
    .digest('hex')
  return `t=${ts},v1=${sig}`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const url = args.url || process.env.STRIPE_WEBHOOK_URL
  const secret = args.secret || process.env.STRIPE_WEBHOOK_SECRET
  const mode = (args.mode || 'checkout').toLowerCase()
  const userId = args['user-id'] || process.env.TEST_USER_ID
  const customerId = args['customer-id'] || process.env.TEST_CUSTOMER_ID
  const status = args.status || process.env.TEST_SUBSCRIPTION_STATUS

  if (!url) {
    throw new Error('Missing webhook URL. Pass --url or set STRIPE_WEBHOOK_URL.')
  }
  if (!secret) {
    throw new Error('Missing webhook secret. Pass --secret or set STRIPE_WEBHOOK_SECRET.')
  }

  const event = buildEvent(mode, userId, customerId, status)
  const payload = JSON.stringify(event)
  const signature = signPayload(payload, secret)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature,
    },
    body: payload,
  })

  const text = await res.text()
  console.log(JSON.stringify({
    ok: res.ok,
    status: res.status,
    mode,
    event_type: event.type,
    response: text,
  }, null, 2))

  if (!res.ok) process.exit(1)
}

main().catch((err) => {
  console.error(`[smoke-stripe-webhook] ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})

