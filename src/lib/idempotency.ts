import crypto from 'crypto'
import { logInfo } from './logger'

export type IdempotencyStatus = 'pending' | 'completed' | 'failed'

export type IdempotencyEntry<T> = {
  status: IdempotencyStatus
  data?: T
  error?: string
  createdAt: number
  expiresAt: number
  promise?: Promise<T>
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getIdempotencyStore(): Map<string, IdempotencyEntry<unknown>> {
  const globalRef = globalThis as typeof globalThis & {
    __pointsmaxIdempotencyStore?: Map<string, IdempotencyEntry<unknown>>
  }
  if (!globalRef.__pointsmaxIdempotencyStore) {
    globalRef.__pointsmaxIdempotencyStore = new Map()
  }
  return globalRef.__pointsmaxIdempotencyStore
}

/**
 * Generates a stable idempotency key from a namespace and one or more
 * discriminating parts (e.g. transfer_partner_id + bonus_pct + end_date).
 */
export function generateIdempotencyKey(namespace: string, ...parts: string[]): string {
  const hash = crypto
    .createHash('sha256')
    .update([namespace, ...parts].join(':'))
    .digest('hex')
  return `idempotent:${namespace}:${hash.slice(0, 32)}`
}

/**
 * Wraps an async operation with idempotency protection.
 *
 * If the key has already been completed within the TTL, returns the stored
 * result without calling `fn` again (idempotent: true).  On first execution
 * (or after TTL expiry) the operation is executed, result stored, and
 * idempotent: false is returned.  Failures clear the key so the caller can
 * retry.
 */
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
  options: { ttlMs?: number } = {},
): Promise<{ data: T; idempotent: boolean }> {
  const store = getIdempotencyStore()
  const now = Date.now()
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS

  const existing = store.get(key)
  if (existing && existing.expiresAt > now && existing.status === 'completed') {
    logInfo('idempotency_key_hit', { key })
    return { data: existing.data as T, idempotent: true }
  }
  if (existing && existing.expiresAt > now && existing.status === 'pending' && existing.promise) {
    logInfo('idempotency_key_hit', { key, status: 'pending' })
    const data = (await existing.promise) as T
    return { data, idempotent: true }
  }

  const pendingPromise = (async () => {
    try {
      const data = await fn()
      store.set(key, { status: 'completed', data, createdAt: now, expiresAt: now + ttl })
      logInfo('idempotency_key_set', { key })
      return data
    } catch (err) {
      // Remove the pending entry so the operation is retryable
      store.delete(key)
      throw err
    }
  })()

  // Mark pending so concurrent duplicate calls reuse the same in-flight promise.
  store.set(key, {
    status: 'pending',
    createdAt: now,
    expiresAt: now + ttl,
    promise: pendingPromise,
  })

  const data = await pendingPromise
  return { data, idempotent: false }
}

/**
 * Removes all expired entries from the in-memory store.
 * Returns the number of entries cleared.
 */
export function clearExpiredIdempotencyKeys(): number {
  const store = getIdempotencyStore()
  const now = Date.now()
  let cleared = 0
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) {
      store.delete(k)
      cleared++
    }
  }
  return cleared
}

/** Exposed for unit tests — do not use in application code. */
export function _getIdempotencyStore() {
  return getIdempotencyStore()
}
