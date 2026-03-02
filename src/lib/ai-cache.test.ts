import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateAiCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
} from './ai-cache'

describe('AiCache', () => {
  beforeEach(() => {
    // Clear global cache store before each test
    const globalRef = globalThis as typeof globalThis & { __pointsmaxAiResponseCache?: Map<string, unknown> }
    if (globalRef.__pointsmaxAiResponseCache) {
      globalRef.__pointsmaxAiResponseCache.clear()
    }
    vi.useFakeTimers()
  })

  it('generates stable keys for same payload', () => {
    const payload = { message: 'hello', context: [1, 2, 3] }
    const key1 = generateAiCacheKey('test', payload)
    const key2 = generateAiCacheKey('test', payload)
    expect(key1).toBe(key2)
    expect(key1).toContain('test:v1.1:')
  })

  it('generates different keys for different payloads', () => {
    const key1 = generateAiCacheKey('test', { m: 'a' })
    const key2 = generateAiCacheKey('test', { m: 'b' })
    expect(key1).not.toBe(key2)
  })

  it('stores and retrieves values', () => {
    const key = 'test-key'
    const data = { reply: 'yes' }
    setCachedAiResponse(key, data)
    expect(getCachedAiResponse(key)).toEqual(data)
  })

  it('respects TTL', () => {
    const key = 'ttl-key'
    const data = 'some-data'
    setCachedAiResponse(key, data, 1000) // 1 second TTL

    expect(getCachedAiResponse(key)).toBe(data)

    // Advance time by 2 seconds
    vi.advanceTimersByTime(2000)

    expect(getCachedAiResponse(key)).toBeNull()
  })

  it('returns null for missing keys', () => {
    expect(getCachedAiResponse('missing')).toBeNull()
  })

  it('prunes old entries when full', () => {
    // Fill cache with 1001 entries
    for (let i = 0; i < 1001; i++) {
      setCachedAiResponse(`key-${i}`, `data-${i}`)
    }
    
    const globalRef = globalThis as typeof globalThis & { __pointsmaxAiResponseCache?: Map<string, unknown> }
    const store = globalRef.__pointsmaxAiResponseCache
    
    // Should have pruned some entries
    expect(store.size).toBeLessThanOrEqual(1000)
    expect(store.size).toBeGreaterThan(0)
  })
})
