import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { getSafeAppOrigin, verifyStripeWebhookSignature } from '@/lib/stripe'

describe('stripe helpers', () => {
  it('verifies valid webhook signatures', () => {
    const secret = 'whsec_test_secret'
    const payload = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' })
    const ts = Math.floor(Date.now() / 1000).toString()
    const sig = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex')
    const header = `t=${ts},v1=${sig}`

    const ok = verifyStripeWebhookSignature({
      payload,
      signatureHeader: header,
      webhookSecret: secret,
    })

    expect(ok).toBe(true)
  })

  it('rejects invalid webhook signatures', () => {
    const ok = verifyStripeWebhookSignature({
      payload: '{"id":"evt_test"}',
      signatureHeader: 't=1111111111,v1=bad',
      webhookSecret: 'whsec_test_secret',
      toleranceSeconds: 999999999,
    })
    expect(ok).toBe(false)
  })

  it('falls back to localhost origin when app URL is missing', () => {
    const old = process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    try {
      expect(getSafeAppOrigin()).toBe('http://localhost:3000')
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = old
    }
  })
})

