import { describe, expect, it, vi } from 'vitest'
import {
  // Date/Time
  fixedIsoDate,
  fixedTimestampMs,
  fixedDate,
  fixedDateString,
  fixedRelativeDate,
  fixedRelativeIsoDate,
  withFixedNow,
  withFakeTimers,
  createFixedDateClass,
  FIXED_TIMESTAMP_MS,
  FIXED_ISO_DATE,
  // UUID
  fixedUuid,
  fixedUuidSequence,
  seededUuid,
  FIXED_UUID,
  // Random
  fixedRandom,
  fixedPick,
  fixedNumberSequence,
  // Async
  fixedResolve,
  fixedReject,
  // Collections
  fixedArray,
  fixedObject,
} from './deterministic'

describe('deterministic test helpers', () => {
  describe('date/time helpers', () => {
    it('provides fixed ISO date string', () => {
      expect(fixedIsoDate()).toBe(FIXED_ISO_DATE)
      expect(fixedIsoDate('custom-date')).toBe('custom-date')
    })

    it('provides fixed timestamp in milliseconds', () => {
      expect(fixedTimestampMs()).toBe(FIXED_TIMESTAMP_MS)
      expect(fixedTimestampMs(12345)).toBe(12345)
    })

    it('creates fixed Date objects', () => {
      const date = fixedDate()
      expect(date.getTime()).toBe(FIXED_TIMESTAMP_MS)
      expect(date.toISOString()).toBe(FIXED_ISO_DATE)
    })

    it('creates fixed Date with custom timestamp', () => {
      const customTime = 1000000000000
      const date = fixedDate(customTime)
      expect(date.getTime()).toBe(customTime)
    })

    it('returns YYYY-MM-DD formatted date string', () => {
      expect(fixedDateString()).toBe('2026-01-01')
    })

    it('calculates relative dates from fixed point', () => {
      const tomorrow = fixedRelativeDate(1)
      expect(tomorrow.toISOString()).toBe('2026-01-02T00:00:00.000Z')

      const yesterday = fixedRelativeDate(-1)
      expect(yesterday.toISOString()).toBe('2025-12-31T00:00:00.000Z')

      const withHours = fixedRelativeDate(0, 5)
      expect(withHours.toISOString()).toBe('2026-01-01T05:00:00.000Z')

      const withMinutes = fixedRelativeDate(0, 0, 30)
      expect(withMinutes.toISOString()).toBe('2026-01-01T00:30:00.000Z')
    })

    it('returns ISO strings for relative dates', () => {
      expect(fixedRelativeIsoDate(1)).toBe('2026-01-02T00:00:00.000Z')
      expect(fixedRelativeIsoDate(-1)).toBe('2025-12-31T00:00:00.000Z')
      expect(fixedRelativeIsoDate(0, 12)).toBe('2026-01-01T12:00:00.000Z')
    })

    it('overrides Date.now() only in callback scope with withFixedNow', () => {
      const before = Date.now()
      const within = withFixedNow(1234, () => Date.now())
      const after = Date.now()

      expect(within).toBe(1234)
      expect(after).toBeGreaterThanOrEqual(before)
    })

    it('restores Date.now() even when callback throws', () => {
      const before = Date.now()
      
      expect(() => {
        withFixedNow(1234, () => {
          expect(Date.now()).toBe(1234)
          throw new Error('test error')
        })
      }).toThrow('test error')

      const after = Date.now()
      expect(after).toBeGreaterThanOrEqual(before)
    })

    it('returns callback result from withFixedNow', () => {
      const result = withFixedNow(FIXED_TIMESTAMP_MS, () => {
        // Note: new Date() constructor is not affected by Date.now override
        // Use fixedDate() or Date.now() for deterministic dates
        return { timestamp: Date.now(), formatted: fixedDate().toISOString() }
      })

      expect(result.timestamp).toBe(FIXED_TIMESTAMP_MS)
      expect(result.formatted).toBe(FIXED_ISO_DATE)
    })

    it('works with fake timers via withFakeTimers', () => {
      const callback = vi.fn()
      
      withFakeTimers((vi) => {
        setTimeout(callback, 1000)
        expect(callback).not.toHaveBeenCalled()
        
        vi.advanceTimersByTime(1000)
        expect(callback).toHaveBeenCalledTimes(1)
      })
    })

    it('restores real timers after withFakeTimers', () => {
      const before = Date.now()
      
      withFakeTimers((vi) => {
        vi.advanceTimersByTime(1000000)
      })

      const after = Date.now()
      // Should be close to real time (within a few seconds)
      expect(after - before).toBeLessThan(5000)
    })

    it('restores timers even when callback throws', async () => {
      await expect(
        withFakeTimers(async () => {
          throw new Error('timer error')
        })
      ).rejects.toThrow('timer error')

      // After error, timers should be real
      const before = Date.now()
      const after = Date.now()
      expect(after).toBeGreaterThanOrEqual(before)
    })

    it('creates fixed Date class', () => {
      const FixedDate = createFixedDateClass(FIXED_TIMESTAMP_MS)
      
      const now = new FixedDate()
      expect(now.getTime()).toBe(FIXED_TIMESTAMP_MS)
      expect(now.toISOString()).toBe(FIXED_ISO_DATE)

      // Should still accept explicit dates
      const specific = new FixedDate('2025-06-15')
      expect(specific.toISOString()).toBe('2025-06-15T00:00:00.000Z')
    })
  })

  describe('UUID helpers', () => {
    it('provides fixed UUID string', () => {
      expect(fixedUuid()).toBe(FIXED_UUID)
      expect(fixedUuid('custom-uuid')).toBe('custom-uuid')
    })

    it('generates sequential UUIDs', () => {
      const uuids = fixedUuidSequence(3)
      
      expect(uuids).toHaveLength(3)
      expect(uuids[0]).toBe('00000000-0000-0000-0000-000000000001')
      expect(uuids[1]).toBe('00000000-0000-0000-0000-000000000002')
      expect(uuids[2]).toBe('00000000-0000-0000-0000-000000000003')
    })

    it('generates empty sequence for count 0', () => {
      expect(fixedUuidSequence(0)).toEqual([])
    })

    it('generates seeded UUIDs', () => {
      expect(seededUuid(1)).toBe('00000000-0000-0000-0000-000000000001')
      expect(seededUuid(255)).toBe('00000000-0000-0000-0000-0000000000ff')
      expect(seededUuid(4096)).toBe('00000000-0000-0000-0000-000000001000')
    })
  })

  describe('random value helpers', () => {
    it('provides fixed random number', () => {
      expect(fixedRandom()).toBe(0.5)
      expect(fixedRandom(0.75)).toBe(0.75)
      expect(fixedRandom(0)).toBe(0)
      expect(fixedRandom(1)).toBe(1)
    })

    it('picks deterministic element from array', () => {
      const arr = ['a', 'b', 'c']
      expect(fixedPick(arr)).toBe('a')
      expect(fixedPick(arr, 1)).toBe('b')
      expect(fixedPick(arr, 2)).toBe('c')
    })

    it('wraps index for fixedPick', () => {
      const arr = ['a', 'b']
      expect(fixedPick(arr, 2)).toBe('a') // 2 % 2 = 0
      expect(fixedPick(arr, 3)).toBe('b') // 3 % 2 = 1
    })

    it('generates number sequences', () => {
      expect(fixedNumberSequence(10, 5)).toEqual([10, 11, 12, 13, 14])
      expect(fixedNumberSequence(0, 3, 10)).toEqual([0, 10, 20])
      expect(fixedNumberSequence(100, 0)).toEqual([])
    })
  })

  describe('async helpers', () => {
    it('creates resolving promise', async () => {
      const value = { test: true }
      const promise = fixedResolve(value)
      
      await expect(promise).resolves.toBe(value)
    })

    it('creates rejecting promise with string', async () => {
      const promise = fixedReject('error message')
      
      await expect(promise).rejects.toThrow('error message')
    })

    it('creates rejecting promise with Error', async () => {
      const error = new Error('custom error')
      const promise = fixedReject(error)
      
      await expect(promise).rejects.toBe(error)
    })
  })

  describe('collection helpers', () => {
    it('creates fixed array with factory function', () => {
      const arr = fixedArray((i) => ({ id: i, value: `item-${i}` }), 3)
      
      expect(arr).toHaveLength(3)
      expect(arr[0]).toEqual({ id: 0, value: 'item-0' })
      expect(arr[1]).toEqual({ id: 1, value: 'item-1' })
      expect(arr[2]).toEqual({ id: 2, value: 'item-2' })
    })

    it('creates empty array for count 0', () => {
      expect(fixedArray(() => 'x', 0)).toEqual([])
    })

    it('creates fixed object with defaults', () => {
      const defaults = { a: 1, b: 'test', c: true }
      const obj = fixedObject(defaults)
      
      expect(obj).toEqual(defaults)
    })

    it('merges overrides into fixed object', () => {
      const defaults = { a: 1, b: 'test', c: true }
      const obj = fixedObject(defaults, { b: 'overridden', c: false })
      
      expect(obj).toEqual({ a: 1, b: 'overridden', c: false })
    })

    it('does not mutate original defaults', () => {
      const defaults = { a: 1, b: 'test' }
      const obj = fixedObject(defaults, { a: 2 })
      
      expect(defaults.a).toBe(1) // Original unchanged
      expect(obj.a).toBe(2)
    })
  })
})
