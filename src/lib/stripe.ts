import { createHmac, timingSafeEqual } from 'node:crypto'

const STRIPE_API_BASE = 'https://api.stripe.com/v1'

type StripeResponse = Record<string, unknown> & {
  error?: { message?: string }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function toSafeOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

export function getSafeAppOrigin(requestUrl?: string): string {
  const fromEnv = toSafeOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (fromEnv) return fromEnv

  const fromRequest = toSafeOrigin(requestUrl)
  if (fromRequest) return fromRequest

  return 'http://localhost:3000'
}

export function getStripeSecretKey(): string | null {
  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  return secret ? secret : null
}

export function getStripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  return secret ? secret : null
}

function parseStripeError(payload: StripeResponse): string {
  if (isObject(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message
  }
  return 'Stripe request failed'
}

async function stripeFormRequest(
  path: string,
  params: URLSearchParams,
  secretKey: string,
): Promise<StripeResponse> {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  })

  const payload = (await res.json().catch(() => ({}))) as StripeResponse
  if (!res.ok) {
    throw new Error(parseStripeError(payload))
  }
  return payload
}

export async function createStripeCustomer(params: {
  secretKey: string
  email: string
  userId: string
}): Promise<{ id: string }> {
  const body = new URLSearchParams()
  body.set('email', params.email)
  body.set('metadata[user_id]', params.userId)

  const payload = await stripeFormRequest('/customers', body, params.secretKey)
  const id = typeof payload.id === 'string' ? payload.id : ''
  if (!id) throw new Error('Stripe customer creation failed')
  return { id }
}

export async function createStripeCheckoutSession(params: {
  secretKey: string
  customerId: string
  userId: string
  successUrl: string
  cancelUrl: string
  priceId?: string | null
}): Promise<{ id: string; url: string }> {
  const body = new URLSearchParams()
  body.set('mode', 'subscription')
  body.set('customer', params.customerId)
  body.set('allow_promotion_codes', 'true')
  body.set('success_url', params.successUrl)
  body.set('cancel_url', params.cancelUrl)
  body.set('client_reference_id', params.userId)
  body.set('metadata[user_id]', params.userId)
  body.set('subscription_data[metadata][user_id]', params.userId)
  body.set('line_items[0][quantity]', '1')

  const priceId = params.priceId?.trim()
  if (priceId) {
    body.set('line_items[0][price]', priceId)
  } else {
    body.set('line_items[0][price_data][currency]', 'usd')
    body.set('line_items[0][price_data][unit_amount]', '999')
    body.set('line_items[0][price_data][recurring][interval]', 'month')
    body.set('line_items[0][price_data][product_data][name]', 'PointsMax Pro')
  }

  const payload = await stripeFormRequest('/checkout/sessions', body, params.secretKey)
  const id = typeof payload.id === 'string' ? payload.id : ''
  const url = typeof payload.url === 'string' ? payload.url : ''
  if (!id || !url) throw new Error('Stripe checkout session creation failed')
  return { id, url }
}

export async function createStripeBillingPortalSession(params: {
  secretKey: string
  customerId: string
  returnUrl: string
}): Promise<{ url: string }> {
  const body = new URLSearchParams()
  body.set('customer', params.customerId)
  body.set('return_url', params.returnUrl)

  const payload = await stripeFormRequest('/billing_portal/sessions', body, params.secretKey)
  const url = typeof payload.url === 'string' ? payload.url : ''
  if (!url) throw new Error('Stripe billing portal session creation failed')
  return { url }
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex')
    const b = Buffer.from(bHex, 'hex')
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function verifyStripeWebhookSignature(params: {
  payload: string
  signatureHeader: string | null
  webhookSecret: string
  toleranceSeconds?: number
}): boolean {
  const toleranceSeconds = params.toleranceSeconds ?? 300
  const signatureHeader = params.signatureHeader
  if (!signatureHeader) return false

  let timestamp = ''
  const signatures: string[] = []

  for (const entry of signatureHeader.split(',')) {
    const [key, value] = entry.split('=', 2)
    if (!key || !value) continue
    if (key === 't') timestamp = value
    if (key === 'v1') signatures.push(value)
  }

  if (!timestamp || signatures.length === 0) return false
  const ts = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(ts)) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > toleranceSeconds) return false

  const signedPayload = `${timestamp}.${params.payload}`
  const expected = createHmac('sha256', params.webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  return signatures.some((candidate) => timingSafeHexEqual(candidate, expected))
}

