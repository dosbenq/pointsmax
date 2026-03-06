import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateIdempotencyKey,
  withIdempotency,
  clearExpiredIdempotencyKeys,
  _getIdempotencyStore,
} from './idempotency'

describe('generateIdempotencyKey', () => {
  it('generates a stable key for the same inputs', () => {
    const k1 = generateIdempotencyKey('bonus-insert', 'partner-1', '30', '2026-06-01')
    const k2 = generateIdempotencyKey('bonus-insert', 'partner-1', '30', '2026-06-01')
    expect(k1).toBe(k2)
  })

  it('generates different keys for different namespaces', () => {
    const k1 = generateIdempotencyKey('ns-a', 'x')
    const k2 = generateIdempotencyKey('ns-b', 'x')
    expect(k1).not.toBe(k2)
  })

  it('generates different keys for different parts', () => {
    const k1 = generateIdempotencyKey('bonus-insert', 'partner-1', '30', '2026-06-01')
    const k2 = generateIdempotencyKey('bonus-insert', 'partner-1', '40', '2026-06-01')
    expect(k1).not.toBe(k2)
  })

  it('prefixes the key with the namespace', () => {
    const k = generateIdempotencyKey('my-ns', 'data')
    expect(k).toMatch(/^idempotent:my-ns:/)
  })
})

describe('withIdempotency', () => {
  beforeEach(() => {
    const store = _getIdempotencyStore()
    store.clear()
    vi.useFakeTimers()
  })

  it('executes fn on first call (idempotent: false)', async () => {
    const fn = vi.fn().mockResolvedValue('result-1')
    const { data, idempotent } = await withIdempotency('key-1', fn)
    expect(data).toBe('result-1')
    expect(idempotent).toBe(false)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('returns cached result on second call (idempotent: true)', async () => {
    const fn = vi.fn().mockResolvedValue('result-2')
    await withIdempotency('key-2', fn)
    const { data, idempotent } = await withIdempotency('key-2', fn)
    expect(data).toBe('result-2')
    expect(idempotent).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1) // fn not called again
  })

  it('does not cache failed operations (allows retry)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient error'))
      .mockResolvedValue('recovered')

    await expect(withIdempotency('key-err', fn)).rejects.toThrow('transient error')

    // Second call should re-execute fn
    const { data, idempotent } = await withIdempotency('key-err', fn)
    expect(data).toBe('recovered')
    expect(idempotent).toBe(false)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('respects TTL and re-executes after expiry', async () => {
    const fn = vi.fn().mockResolvedValue('value')
    await withIdempotency('key-ttl', fn, { ttlMs: 1000 })
    expect(fn).toHaveBeenCalledTimes(1)

    // Advance past TTL
    vi.advanceTimersByTime(1500)

    const { idempotent } = await withIdempotency('key-ttl', fn, { ttlMs: 1000 })
    expect(idempotent).toBe(false)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('stores result in in-memory store after completion', async () => {
    const store = _getIdempotencyStore()
    await withIdempotency('key-store', async () => 'stored-data')
    const entry = store.get('key-store')
    expect(entry?.status).toBe('completed')
    expect(entry?.data).toBe('stored-data')
  })

  it('deduplicates concurrent duplicate calls and reuses the in-flight promise', async () => {
    let resolveFn: ((value: string) => void) | null = null
    const fn = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve
        }),
    )

    const firstCall = withIdempotency('key-concurrent', fn)
    const secondCall = withIdempotency('key-concurrent', fn)

    expect(fn).toHaveBeenCalledTimes(1)

    resolveFn?.('shared-result')

    await expect(firstCall).resolves.toEqual({ data: 'shared-result', idempotent: false })
    await expect(secondCall).resolves.toEqual({ data: 'shared-result', idempotent: true })
  })
})

describe('clearExpiredIdempotencyKeys', () => {
  beforeEach(() => {
    _getIdempotencyStore().clear()
    vi.useFakeTimers()
  })

  it('removes expired entries and returns count', async () => {
    await withIdempotency('live-key', async () => 'live', { ttlMs: 5000 })
    await withIdempotency('dead-key', async () => 'dead', { ttlMs: 500 })

    vi.advanceTimersByTime(1000)

    const cleared = clearExpiredIdempotencyKeys()
    expect(cleared).toBe(1)
    expect(_getIdempotencyStore().has('dead-key')).toBe(false)
    expect(_getIdempotencyStore().has('live-key')).toBe(true)
  })

  it('returns 0 when no entries have expired', async () => {
    await withIdempotency('fresh-key', async () => 'ok', { ttlMs: 60_000 })
    const cleared = clearExpiredIdempotencyKeys()
    expect(cleared).toBe(0)
  })
})
