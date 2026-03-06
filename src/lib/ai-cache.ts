import crypto from 'crypto'
import { logInfo } from './logger'

export type AiCacheEntry<T> = {
  data: T
  expiresAt: number
  version: string
}

export type AiCacheStats = {
  totalEntries: number
  hitCount: number
  missCount: number
  currentVersion: string
  oldestEntry?: number
  newestEntry?: number
}

const DEFAULT_TTL_MS = 30 * 60 * 1000 // 30 minutes

// Versioned cache keys for safe invalidation
// Bump this to invalidate all existing caches (e.g., when AI prompt/format changes)
const CACHE_VERSION_BASE = 'v1.2'

// Allow runtime version override via env for emergency cache invalidation
function getCacheVersion(): string {
  const envVersion = process.env.AI_CACHE_VERSION_OVERRIDE?.trim()
  return envVersion || CACHE_VERSION_BASE
}

// Stats tracking for cache instrumentation
let hitCounter = 0
let missCounter = 0

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
 * 
 * Cache key format: {namespace}:{version}:{sha256(payload)}
 * Version allows safe invalidation when AI prompts or response formats change.
 */
export function generateAiCacheKey(namespace: string, payload: unknown): string {
  const version = getCacheVersion()
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
  return `${namespace}:${version}:${hash}`
}

/**
 * Extracts version from a cache key for debugging/auditing.
 */
export function extractCacheKeyVersion(key: string): string | null {
  const parts = key.split(':')
  return parts.length >= 2 ? parts[1] : null
}

/**
 * Resets cache statistics counters.
 */
export function resetAiCacheStats(): void {
  hitCounter = 0
  missCounter = 0
}

/**
 * Gets current cache statistics for instrumentation.
 */
export function getAiCacheStats(): AiCacheStats {
  const store = getAiCacheStore()
  let oldestEntry: number | undefined
  let newestEntry: number | undefined

  for (const entry of store.values()) {
    if (oldestEntry === undefined || entry.expiresAt < oldestEntry) {
      oldestEntry = entry.expiresAt
    }
    if (newestEntry === undefined || entry.expiresAt > newestEntry) {
      newestEntry = entry.expiresAt
    }
  }

  return {
    totalEntries: store.size,
    hitCount: hitCounter,
    missCount: missCounter,
    currentVersion: getCacheVersion(),
    oldestEntry,
    newestEntry,
  }
}

/**
 * Clears all cache entries (useful for testing or admin operations).
 */
export function clearAiCache(): void {
  const store = getAiCacheStore()
  store.clear()
  resetAiCacheStats()
}

export function getCachedAiResponse<T>(key: string): T | null {
  const store = getAiCacheStore()
  const entry = store.get(key)
  const now = Date.now()
  const currentVersion = getCacheVersion()

  if (entry && entry.expiresAt > now && entry.version === currentVersion) {
    hitCounter++
    return entry.data as T
  }

  // Clean up expired or version-mismatched entries
  if (entry) {
    store.delete(key)
  }
  missCounter++
  return null
}

export function setCachedAiResponse<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const store = getAiCacheStore()
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    version: getCacheVersion(),
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
  const stats = getAiCacheStats()
  logInfo(`ai_cache_${event}`, { 
    namespace, 
    requestId, 
    version: getCacheVersion(),
    hitRate: stats.hitCount + stats.missCount > 0 
      ? stats.hitCount / (stats.hitCount + stats.missCount) 
      : 0,
    cacheSize: stats.totalEntries,
  })
}
