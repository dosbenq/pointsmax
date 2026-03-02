import crypto from 'crypto'
import { logInfo } from './logger'

export type AiCacheEntry<T> = {
  data: T
  expiresAt: number
  version: string
}

const DEFAULT_TTL_MS = 30 * 60 * 1000 // 30 minutes
const CACHE_VERSION = 'v1.1' // Increment to invalidate all caches

function getAiCacheStore(): Map<string, AiCacheEntry<unknown>> {
  const globalRef = globalThis as typeof globalThis & {
    __pointsmaxAiResponseCache?: Map<string, AiCacheEntry<unknown>>
  }
  if (!globalRef.__pointsmaxAiResponseCache) {
    globalRef.__pointsmaxAiResponseCache = new Map<string, AiCacheEntry<unknown>>()
  }
  return globalRef.__pointsmaxAiResponseCache
}

/**
 * Generates a stable cache key based on the payload and a version.
 * Sensitive data should be hashed for privacy if stored in a shared cache,
 * but here it's in-memory so hashing is primarily for key size/stability.
 */
export function generateAiCacheKey(namespace: string, payload: unknown): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
  return `${namespace}:${CACHE_VERSION}:${hash}`
}

export function getCachedAiResponse<T>(key: string): T | null {
  const store = getAiCacheStore()
  const entry = store.get(key)
  const now = Date.now()

  if (entry && entry.expiresAt > now && entry.version === CACHE_VERSION) {
    return entry.data as T
  }

  if (entry && entry.expiresAt <= now) {
    store.delete(key)
  }

  return null
}

export function setCachedAiResponse<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const store = getAiCacheStore()
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    version: CACHE_VERSION,
  })

  // Basic pruning if store grows too large
  if (store.size > 1000) {
    const now = Date.now()
    for (const [k, v] of store.entries()) {
      if (v.expiresAt <= now) {
        store.delete(k)
      }
    }
    // If still too large, remove oldest (first) entries
    if (store.size > 1000) {
      const keys = store.keys()
      while (store.size > 800) {
        const next = keys.next()
        if (next.done) break
        store.delete(next.value)
      }
    }
  }
}

export function logAiCacheMetric(event: 'hit' | 'miss', namespace: string, requestId?: string) {
  logInfo(`ai_cache_${event}`, { namespace, requestId, version: CACHE_VERSION })
}
