import crypto from 'crypto'

const TOKEN_VERSION = 'v1'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getTokenSecret(): string {
  const secret = process.env.ALERTS_TOKEN_SECRET ?? process.env.CRON_SECRET
  if (!secret) {
    throw new Error('ALERTS_TOKEN_SECRET or CRON_SECRET must be configured')
  }
  return secret
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url')
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf-8')
}

function sign(payloadB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

export function createUnsubscribeToken(email: string): string | null {
  const normalizedEmail = email.trim().toLowerCase()
  let secret: string
  try {
    secret = getTokenSecret()
  } catch {
    return null
  }
  const payload = {
    v: TOKEN_VERSION,
    email: normalizedEmail,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const sig = sign(payloadB64, secret)
  return `${payloadB64}.${sig}`
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null

  let secret: string
  try {
    secret = getTokenSecret()
  } catch {
    return null
  }
  const expectedSig = sign(payloadB64, secret)

  const sigBuf = Buffer.from(sig, 'base64url')
  const expectedBuf = Buffer.from(expectedSig, 'base64url')
  if (sigBuf.length !== expectedBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as {
      v?: string
      email?: string
      exp?: number
    }
    if (payload.v !== TOKEN_VERSION) return null
    if (!payload.email || typeof payload.email !== 'string') return null
    if (!payload.email.includes('@')) return null
    if (!payload.exp || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.email.trim().toLowerCase()
  } catch {
    return null
  }
}
