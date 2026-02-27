/**
 * Deterministic Test Fixture Utilities
 * 
 * Testing Policy:
 * - All date/time dependent tests must use these helpers for deterministic behavior
 * - Never use Date.now() or new Date() directly in test assertions
 * - Use withFixedNow() for simple time mocking, withFakeTimers() for complex scenarios
 * - UUIDs should use fixedUuid() or fixedUuidSequence() for predictable test data
 * - Always restore mocks in finally blocks or afterEach hooks
 * 
 * @example
 * ```ts
 * // Date mocking
 * withFixedNow(fixedTimestampMs(), () => {
 *   expect(getExpiryDate()).toBe('2026-01-01T00:00:00.000Z')
 * })
 * 
 * // UUID generation
 * const id = fixedUuid() // '11111111-1111-1111-1111-111111111111'
 * const [id1, id2] = fixedUuidSequence(2) // sequential UUIDs
 * 
 * // Timer control with vitest
 * withFakeTimers((vi) => {
 *   vi.advanceTimersByTime(1000)
 *   expect(timerCallback).toHaveBeenCalled()
 * })
 * ```
 */

import { vi, type VitestUtils } from 'vitest'

// ============================================================================
// Fixed Values
// ============================================================================

/** Default fixed timestamp: 2026-01-01T00:00:00.000Z */
export const FIXED_TIMESTAMP_MS = 1767225600000

/** Default fixed ISO date string */
export const FIXED_ISO_DATE = '2026-01-01T00:00:00.000Z'

/** Default fixed UUID */
export const FIXED_UUID = '11111111-1111-1111-1111-111111111111'

// ============================================================================
// Date/Time Helpers
// ============================================================================

/**
 * Returns a fixed ISO date string.
 * Use for consistent date values in test data.
 */
export function fixedIsoDate(value = FIXED_ISO_DATE): string {
  return value
}

/**
 * Returns a fixed timestamp in milliseconds.
 * Use for consistent time-based calculations.
 */
export function fixedTimestampMs(value = FIXED_TIMESTAMP_MS): number {
  return value
}

/**
 * Returns a Date object at a fixed point in time.
 */
export function fixedDate(timestampMs = FIXED_TIMESTAMP_MS): Date {
  return new Date(timestampMs)
}

/**
 * Returns a fixed date string in YYYY-MM-DD format.
 */
export function fixedDateString(timestampMs = FIXED_TIMESTAMP_MS): string {
  return new Date(timestampMs).toISOString().split('T')[0]
}

/**
 * Returns a relative date offset from the fixed timestamp.
 * @param daysOffset - Number of days to add (positive or negative)
 * @param hoursOffset - Number of hours to add (positive or negative)
 * @param minutesOffset - Number of minutes to add (positive or negative)
 */
export function fixedRelativeDate(
  daysOffset = 0,
  hoursOffset = 0,
  minutesOffset = 0
): Date {
  const ms = FIXED_TIMESTAMP_MS +
    daysOffset * 24 * 60 * 60 * 1000 +
    hoursOffset * 60 * 60 * 1000 +
    minutesOffset * 60 * 1000
  return new Date(ms)
}

/**
 * Returns an ISO date string offset from the fixed timestamp.
 */
export function fixedRelativeIsoDate(
  daysOffset = 0,
  hoursOffset = 0,
  minutesOffset = 0
): string {
  return fixedRelativeDate(daysOffset, hoursOffset, minutesOffset).toISOString()
}

/**
 * Executes a function with Date.now() returning a fixed timestamp.
 * Automatically restores Date.now after execution (even on error).
 * 
 * @example
 * ```ts
 * const result = withFixedNow(fixedTimestampMs(), () => {
 *   return Date.now() // returns fixed timestamp
 * })
 * ```
 */
export function withFixedNow<T>(timestampMs: number, run: () => T): T {
  vi.useFakeTimers({ now: timestampMs })
  try {
    return run()
  } finally {
    vi.useRealTimers()
  }
}

/**
 * Executes an async function with fake timers enabled.
 * Automatically restores real timers after execution (even on error).
 * 
 * @example
 * ```ts
 * await withFakeTimers(async (vi) => {
 *   const callback = vi.fn()
 *   setTimeout(callback, 1000)
 *   vi.advanceTimersByTime(1000)
 *   expect(callback).toHaveBeenCalled()
 * })
 * ```
 */
export function withFakeTimers<T>(
  run: (vi: VitestUtils) => Promise<T> | T,
  initialTime = FIXED_TIMESTAMP_MS
): Promise<T> | T {
  vi.useFakeTimers({ now: initialTime })
  try {
    const result = run(vi)
    if (result && typeof (result as Promise<T>).then === 'function') {
      return (result as Promise<T>).finally(() => {
        vi.useRealTimers()
      })
    }
    vi.useRealTimers()
    return result
  } catch (error) {
    vi.useRealTimers()
    throw error
  }
}

/**
 * Creates a mock Date constructor that returns fixed dates.
 * Useful for mocking the entire Date class.
 */
export function createFixedDateClass(fixedTimestamp = FIXED_TIMESTAMP_MS): typeof Date {
  return class FixedDate extends Date {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedTimestamp)
      } else if (args.length === 1) {
        super(args[0] as string | number | Date)
      } else {
        const [year, month, date, hours, minutes, seconds, ms] = args as number[]
        super(
          year,
          month,
          date ?? 1,
          hours ?? 0,
          minutes ?? 0,
          seconds ?? 0,
          ms ?? 0
        )
      }
    }
  } as typeof Date
}

// ============================================================================
// UUID Helpers
// ============================================================================

/**
 * Returns a fixed UUID string.
 * Use for consistent identifier values in test data.
 */
export function fixedUuid(value = FIXED_UUID): string {
  return value
}

/**
 * Generates a sequence of deterministic UUIDs.
 * Each UUID in the sequence is unique but deterministic.
 * 
 * @example
 * ```ts
 * const [id1, id2, id3] = fixedUuidSequence(3)
 * // id1: '00000000-0000-0000-0000-000000000001'
 * // id2: '00000000-0000-0000-0000-000000000002'
 * // id3: '00000000-0000-0000-0000-000000000003'
 * ```
 */
export function fixedUuidSequence(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const num = (i + 1).toString().padStart(12, '0')
    return `00000000-0000-0000-0000-${num}`
  })
}

/**
 * Generates a UUID based on a seed number.
 * Same seed always produces the same UUID.
 */
export function seededUuid(seed: number): string {
  const hex = seed.toString(16).padStart(12, '0')
  return `00000000-0000-0000-0000-${hex}`
}

// ============================================================================
// Random Value Helpers (Deterministic)
// ============================================================================

/**
 * Returns a fixed "random" number based on seed.
 * Use instead of Math.random() for deterministic tests.
 */
export function fixedRandom(seed = 0.5): number {
  return seed
}

/**
 * Picks a deterministic element from an array.
 * Always returns the element at index 0 unless specified.
 */
export function fixedPick<T>(array: T[], index = 0): T {
  return array[index % array.length]
}

/**
 * Generates a sequence of numbers from a starting value.
 */
export function fixedNumberSequence(start: number, count: number, step = 1): number[] {
  return Array.from({ length: count }, (_, i) => start + i * step)
}

// ============================================================================
// Async Helpers
// ============================================================================

/**
 * Creates a promise that resolves immediately with a fixed value.
 * Useful for mocking async operations.
 */
export function fixedResolve<T>(value: T): Promise<T> {
  return Promise.resolve(value)
}

/**
 * Creates a promise that rejects immediately with a fixed error.
 * Useful for testing error handling.
 */
export function fixedReject(error: Error | string): Promise<never> {
  const err = typeof error === 'string' ? new Error(error) : error
  return Promise.reject(err)
}

// ============================================================================
// Collection Helpers
// ============================================================================

/**
 * Creates a fixed-size array with generated values.
 */
export function fixedArray<T>(factory: (index: number) => T, count: number): T[] {
  return Array.from({ length: count }, (_, i) => factory(i))
}

/**
 * Creates a fixed object with default values merged with overrides.
 */
export function fixedObject<T extends Record<string, unknown>>(
  defaults: T,
  overrides: Partial<T> = {}
): T {
  return { ...defaults, ...overrides }
}
