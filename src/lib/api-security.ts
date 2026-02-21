import { NextRequest, NextResponse } from 'next/server'

type RateLimitConfig = {
  namespace: string
  maxRequests: number
  windowMs: number
}

type Counter = {
  count: number
  resetAt: number
}

type UpstashEvalResult = {
  result?: [number, number] | string | number
  error?: string
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? ''
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? ''
const HAS_UPSTASH = !!UPSTASH_URL && !!UPSTASH_TOKEN

function getStore(): Map<string, Counter> {
  const globalWithStore = globalThis as typeof globalThis & {
    __pointsmaxRateLimitStore?: Map<string, Counter>
  }

  if (!globalWithStore.__pointsmaxRateLimitStore) {
    globalWithStore.__pointsmaxRateLimitStore = new Map<string, Counter>()
  }
  return globalWithStore.__pointsmaxRateLimitStore
}

function cleanupStore(store: Map<string, Counter>, now: number) {
  if (store.size < 10_000) return
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) store.delete(key)
  }
}

async function incrementDistributedCounter(
  key: string,
  windowMs: number,
): Promise<Counter | null> {
  if (!HAS_UPSTASH) return null

  const script = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {count, ttl}
`.trim()

  const response = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['EVAL', script, '1', key, String(windowMs)]),
    cache: 'no-store',
  })

  if (!response.ok) return null
  const payload = (await response.json()) as UpstashEvalResult
  if (payload.error) return null

  const resultTuple = Array.isArray(payload.result) ? payload.result : null
  if (!resultTuple || resultTuple.length < 2) return null

  const count = Number(resultTuple[0])
  let ttlMs = Number(resultTuple[1])
  if (!Number.isFinite(count)) return null
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) ttlMs = windowMs

  return {
    count,
    resetAt: Date.now() + ttlMs,
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export function enforceJsonContentLength(
  req: NextRequest,
  maxBytes: number,
): NextResponse | undefined {
  const contentLength = req.headers.get('content-length')
  if (!contentLength) return undefined

  const value = Number(contentLength)
  if (!Number.isFinite(value)) return undefined
  if (value <= maxBytes) return undefined

  return NextResponse.json(
    { error: `Payload too large. Max ${maxBytes} bytes.` },
    { status: 413 },
  )
}

function enforceRateLimitInMemory(
  req: NextRequest,
  config: RateLimitConfig,
  customKey?: string,
): Counter {
  const now = Date.now()
  const store = getStore()
  cleanupStore(store, now)

  const keyBase = customKey ?? getClientIp(req)
  const key = `${config.namespace}:${keyBase}`
  const current = store.get(key)

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + config.windowMs }
    store.set(key, next)
    return next
  }

  current.count += 1
  store.set(key, current)
  return current
}

export async function enforceRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  customKey?: string,
): Promise<NextResponse | undefined> {
  const keyBase = customKey ?? getClientIp(req)
  const key = `${config.namespace}:${keyBase}`

  let current: Counter
  try {
    const distributed = await incrementDistributedCounter(key, config.windowMs)
    current = distributed ?? enforceRateLimitInMemory(req, config, customKey)
  } catch {
    current = enforceRateLimitInMemory(req, config, customKey)
  }

  if (current.count <= config.maxRequests) return undefined

  const now = Date.now()
  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  return NextResponse.json(
    { error: 'Too many requests. Please try again shortly.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    },
  )
}
