import crypto from 'crypto'

const TOKEN_VERSION = 'v1'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90 // 90 days

function getSecret(): string {
  const secret = process.env.ALERTS_TOKEN_SECRET ?? process.env.CRON_SECRET
  if (!process.env.ALERTS_TOKEN_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('[security] ALERTS_TOKEN_SECRET not set — falling back to CRON_SECRET. Set a separate secret for production.')
  }
  if (!secret) {
    throw new Error('ALERTS_TOKEN_SECRET or CRON_SECRET must be configured')
  }
  return secret
}

function sign(payloadB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

export function createDigestUnsubscribeToken(userId: string): string | null {
  if (!userId) return null
  let secret: string
  try {
    secret = getSecret()
  } catch {
    return null
  }
  const payloadB64 = Buffer.from(JSON.stringify({
    v: TOKEN_VERSION,
    user_id: userId,
    scope: 'digest',
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }), 'utf8').toString('base64url')
  return `${payloadB64}.${sign(payloadB64, secret)}`
}

export function verifyDigestUnsubscribeToken(token: string): string | null {
  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return null

  let secret: string
  try {
    secret = getSecret()
  } catch {
    return null
  }

  const expected = sign(payloadB64, secret)
  const left = Buffer.from(signature, 'base64url')
  const right = Buffer.from(expected, 'base64url')
  if (left.length !== right.length) return null
  if (!crypto.timingSafeEqual(left, right)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      v?: string
      user_id?: string
      scope?: string
      exp?: number
    }
    if (payload.v !== TOKEN_VERSION || payload.scope !== 'digest') return null
    if (typeof payload.user_id !== 'string' || !payload.user_id) return null
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.user_id
  } catch {
    return null
  }
}
