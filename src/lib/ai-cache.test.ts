import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  generateAiCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
  getAiCacheStats,
  resetAiCacheStats,
  clearAiCache,
  extractCacheKeyVersion,
} from './ai-cache'

describe('AiCache', () => {
  beforeEach(() => {
    // Clear global cache store before each test
    clearAiCache()
    vi.useFakeTimers()
    // Reset env override
    delete process.env.AI_CACHE_VERSION_OVERRIDE
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.AI_CACHE_VERSION_OVERRIDE
  })

  describe('key generation', () => {
    it('generates stable keys for same payload', () => {
      const payload = { message: 'hello', context: [1, 2, 3] }
      const key1 = generateAiCacheKey('test', payload)
      const key2 = generateAiCacheKey('test', payload)
      expect(key1).toBe(key2)
      expect(key1).toMatch(/^test:v\d+\.\d+:[a-f0-9]{64}$/)
    })

    it('generates different keys for different payloads', () => {
      const key1 = generateAiCacheKey('test', { m: 'a' })
      const key2 = generateAiCacheKey('test', { m: 'b' })
      expect(key1).not.toBe(key2)
    })

    it('generates different keys for different namespaces', () => {
      const payload = { m: 'a' }
      const key1 = generateAiCacheKey('ns1', payload)
      const key2 = generateAiCacheKey('ns2', payload)
      expect(key1).not.toBe(key2)
    })

    it('includes version in cache key', () => {
      const key = generateAiCacheKey('test', { m: 'a' })
      const version = extractCacheKeyVersion(key)
      expect(version).toBeTruthy()
      expect(version).toMatch(/^v\d+\.\d+$/)
    })

    it('respects env override for version', () => {
      process.env.AI_CACHE_VERSION_OVERRIDE = 'v99.9'
      const key = generateAiCacheKey('test', { m: 'a' })
      expect(key).toContain(':v99.9:')
      expect(extractCacheKeyVersion(key)).toBe('v99.9')
    })
  })

  describe('store and retrieve', () => {
    it('stores and retrieves values', () => {
      const key = 'test-key'
      const data = { reply: 'yes' }
      setCachedAiResponse(key, data)
      expect(getCachedAiResponse(key)).toEqual(data)
    })

    it('returns null for missing keys', () => {
      expect(getCachedAiResponse('missing')).toBeNull()
    })

    it('handles complex objects', () => {
      const key = 'complex-key'
      const data = {
        nested: { array: [1, 2, 3], obj: { a: 'b' } },
        nullValue: null,
        bool: true,
        number: 42.5,
      }
      setCachedAiResponse(key, data)
      expect(getCachedAiResponse(key)).toEqual(data)
    })

    it('handles string data', () => {
      const key = 'string-key'
      const data = 'Hello, World!'
      setCachedAiResponse(key, data)
      expect(getCachedAiResponse(key)).toBe(data)
    })
  })

  describe('TTL behavior', () => {
    it('respects TTL', () => {
      const key = 'ttl-key'
      const data = 'some-data'
      setCachedAiResponse(key, data, 1000) // 1 second TTL

      expect(getCachedAiResponse(key)).toBe(data)

      // Advance time by 2 seconds
      vi.advanceTimersByTime(2000)

      expect(getCachedAiResponse(key)).toBeNull()
    })

    it('respects custom TTL per entry', () => {
      const shortKey = 'short'
      const longKey = 'long'
      
      setCachedAiResponse(shortKey, 'short-data', 1000) // 1 second
      setCachedAiResponse(longKey, 'long-data', 10000) // 10 seconds

      // Advance 5 seconds
      vi.advanceTimersByTime(5000)

      // Short should be expired, long should still exist
      expect(getCachedAiResponse(shortKey)).toBeNull()
      expect(getCachedAiResponse(longKey)).toBe('long-data')
    })

    it('uses default TTL when not specified', () => {
      const key = 'default-ttl'
      const data = 'data'
      
      setCachedAiResponse(key, data) // Uses default 30 min

      // Advance 29 minutes
      vi.advanceTimersByTime(29 * 60 * 1000)
      expect(getCachedAiResponse(key)).toBe(data)

      // Advance 2 more minutes
      vi.advanceTimersByTime(2 * 60 * 1000)
      expect(getCachedAiResponse(key)).toBeNull()
    })
  })

  describe('version-based invalidation', () => {
    it('invalidates entries when version changes', () => {
      const key = generateAiCacheKey('test', { m: 'a' })
      setCachedAiResponse(key, 'data')
      expect(getCachedAiResponse(key)).toBe('data')

      // Simulate version change via env override
      process.env.AI_CACHE_VERSION_OVERRIDE = 'v99.9'
      
      // Old key should be invalid now
      expect(getCachedAiResponse(key)).toBeNull()

      // New key with new version should work
      const newKey = generateAiCacheKey('test', { m: 'a' })
      setCachedAiResponse(newKey, 'new-data')
      expect(getCachedAiResponse(newKey)).toBe('new-data')
    })

    it('removes version-mismatched entries on lookup', () => {
      const key = generateAiCacheKey('test', { m: 'a' })
      setCachedAiResponse(key, 'data')
      
      // Change version
      process.env.AI_CACHE_VERSION_OVERRIDE = 'v99.9'
      
      // Lookup should delete old entry
      getCachedAiResponse(key)
      
      // Restore version
      delete process.env.AI_CACHE_VERSION_OVERRIDE
      
      // Should still be missing (was deleted)
      expect(getCachedAiResponse(key)).toBeNull()
    })
  })

  describe('cache statistics', () => {
    it('tracks total entries', () => {
      setCachedAiResponse('key1', 'data1')
      setCachedAiResponse('key2', 'data2')
      setCachedAiResponse('key3', 'data3')

      const stats = getAiCacheStats()
      expect(stats.totalEntries).toBe(3)
    })

    it('tracks hits and misses', () => {
      setCachedAiResponse('existing', 'data')
      
      // Hit
      getCachedAiResponse('existing')
      // Miss
      getCachedAiResponse('non-existing')

      const stats = getAiCacheStats()
      expect(stats.hitCount).toBe(1)
      expect(stats.missCount).toBe(1)
    })

    it('reports current version', () => {
      const stats = getAiCacheStats()
      expect(stats.currentVersion).toMatch(/^v\d+\.\d+$/)
    })

    it('tracks entry timestamps', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      
      setCachedAiResponse('key1', 'data1', 60000) // 1 min TTL
      
      const stats = getAiCacheStats()
      expect(stats.oldestEntry).toBe(now + 60000)
      expect(stats.newestEntry).toBe(now + 60000)
    })

    it('resets statistics', () => {
      setCachedAiResponse('key', 'data')
      getCachedAiResponse('key') // Hit
      getCachedAiResponse('missing') // Miss

      resetAiCacheStats()

      const stats = getAiCacheStats()
      expect(stats.hitCount).toBe(0)
      expect(stats.missCount).toBe(0)
      expect(stats.totalEntries).toBe(1) // Entries preserved, just counters reset
    })
  })

  describe('cache pruning', () => {
    it('prunes old entries when full', () => {
      // Fill cache with 1001 entries
      for (let i = 0; i < 1001; i++) {
        setCachedAiResponse(`key-${i}`, `data-${i}`)
      }
      
      const stats = getAiCacheStats()
      
      // Should have pruned some entries
      expect(stats.totalEntries).toBeLessThanOrEqual(1000)
      expect(stats.totalEntries).toBeGreaterThan(0)
    })

    it('clears all entries', () => {
      setCachedAiResponse('key1', 'data1')
      setCachedAiResponse('key2', 'data2')
      
      clearAiCache()
      
      const stats = getAiCacheStats()
      expect(stats.totalEntries).toBe(0)
      expect(getCachedAiResponse('key1')).toBeNull()
      expect(getCachedAiResponse('key2')).toBeNull()
    })
  })

  describe('namespace isolation', () => {
    it('isolates different namespaces', () => {
      const payload = { m: 'a' }
      const key1 = generateAiCacheKey('recommend', payload)
      const key2 = generateAiCacheKey('expert-chat', payload)

      setCachedAiResponse(key1, 'recommend-data')
      setCachedAiResponse(key2, 'chat-data')

      expect(getCachedAiResponse(key1)).toBe('recommend-data')
      expect(getCachedAiResponse(key2)).toBe('chat-data')
    })
  })
})
