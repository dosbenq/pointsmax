import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  retryWithBackoff,
  recordDlqEntry,
  getDlqEntries,
  _clearDlqStore,
  INNGEST_RETRY_CONFIG,
} from './queue-durability'

// ─────────────────────────────────────────────────────────────────────────────
// retryWithBackoff
// ─────────────────────────────────────────────────────────────────────────────

describe('retryWithBackoff', () => {
  const noopSleep = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    noopSleep.mockClear()
  })

  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await retryWithBackoff(fn, {}, noopSleep)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(noopSleep).not.toHaveBeenCalled()
  })

  it('retries and succeeds on the second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('recovered')

    const result = await retryWithBackoff(fn, { maxAttempts: 3 }, noopSleep)
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(noopSleep).toHaveBeenCalledTimes(1) // slept once between attempts
  })

  it('throws after exhausting all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))
    await expect(
      retryWithBackoff(fn, { maxAttempts: 3 }, noopSleep),
    ).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('uses exponential backoff delays', async () => {
    const delays: number[] = []
    const recordingSleep = vi.fn().mockImplementation(async (ms: number) => {
      delays.push(ms)
    })
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(
      retryWithBackoff(
        fn,
        { maxAttempts: 4, initialDelayMs: 100, backoffMultiplier: 2, maxDelayMs: 10_000 },
        recordingSleep,
      ),
    ).rejects.toThrow()

    // Delays: attempt 1→2: 100ms, attempt 2→3: 200ms, attempt 3→4: 400ms
    expect(delays).toEqual([100, 200, 400])
  })

  it('respects maxDelayMs cap', async () => {
    const delays: number[] = []
    const recordingSleep = vi.fn().mockImplementation(async (ms: number) => {
      delays.push(ms)
    })
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(
      retryWithBackoff(
        fn,
        { maxAttempts: 5, initialDelayMs: 1000, backoffMultiplier: 10, maxDelayMs: 2000 },
        recordingSleep,
      ),
    ).rejects.toThrow()

    // All delays should be capped at maxDelayMs
    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(2000)
    }
  })

  it('stops retrying when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'))
    const shouldRetry = vi.fn().mockReturnValue(false)

    await expect(
      retryWithBackoff(fn, { maxAttempts: 5, shouldRetry }, noopSleep),
    ).rejects.toThrow('permanent')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(noopSleep).not.toHaveBeenCalled()
  })

  it('passes attempt number to shouldRetry', async () => {
    const attempts: number[] = []
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const shouldRetry = vi.fn().mockImplementation((_err: unknown, attempt: number) => {
      attempts.push(attempt)
      return attempt < 2 // allow retry after attempt 1, stop after attempt 2
    })

    await expect(
      retryWithBackoff(fn, { maxAttempts: 5, shouldRetry }, noopSleep),
    ).rejects.toThrow()

    // shouldRetry is called for attempts 1 (returns true → retry) and 2 (returns false → stop)
    expect(attempts).toEqual([1, 2])
    // fn ran on attempt 1 (failed → shouldRetry true) and attempt 2 (failed → shouldRetry false → break)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// recordDlqEntry / getDlqEntries
// ─────────────────────────────────────────────────────────────────────────────

describe('recordDlqEntry', () => {
  beforeEach(() => {
    _clearDlqStore()
  })

  it('stores a DLQ entry with a createdAt timestamp', () => {
    recordDlqEntry({
      functionId: 'bonus-curator',
      eventName: 'bonus-curator',
      errorMessage: 'Timeout',
      retryCount: 3,
    })
    const entries = getDlqEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].functionId).toBe('bonus-curator')
    expect(entries[0].errorMessage).toBe('Timeout')
    expect(entries[0].retryCount).toBe(3)
    expect(entries[0].createdAt).toBeTruthy()
  })

  it('returns the stored entry', () => {
    const entry = recordDlqEntry({
      functionId: 'deal-scout',
      eventName: 'deal-scout',
      errorMessage: 'API error',
      retryCount: 5,
      payload: { watchId: 'abc' },
    })
    expect(entry.functionId).toBe('deal-scout')
    expect(entry.payload).toEqual({ watchId: 'abc' })
  })

  it('stores multiple distinct entries', () => {
    recordDlqEntry({ functionId: 'fn-a', eventName: 'ev-a', errorMessage: 'err', retryCount: 1 })
    recordDlqEntry({ functionId: 'fn-b', eventName: 'ev-b', errorMessage: 'err', retryCount: 2 })
    expect(getDlqEntries()).toHaveLength(2)
  })

  it('returns a snapshot (not a mutable reference)', () => {
    recordDlqEntry({ functionId: 'fn', eventName: 'ev', errorMessage: 'e', retryCount: 0 })
    const snap1 = getDlqEntries()
    recordDlqEntry({ functionId: 'fn2', eventName: 'ev2', errorMessage: 'e', retryCount: 0 })
    expect(snap1).toHaveLength(1) // snapshot unchanged
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// INNGEST_RETRY_CONFIG
// ─────────────────────────────────────────────────────────────────────────────

describe('INNGEST_RETRY_CONFIG', () => {
  it('standard has 3 retries', () => {
    expect(INNGEST_RETRY_CONFIG.standard.retries).toBe(3)
  })

  it('financial has 5 retries', () => {
    expect(INNGEST_RETRY_CONFIG.financial.retries).toBe(5)
  })

  it('noRetry has 0 retries', () => {
    expect(INNGEST_RETRY_CONFIG.noRetry.retries).toBe(0)
  })
})
