import { describe, expect, it } from 'vitest'
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  withTimeout,
} from './circuit-breaker'
import { withFakeTimers } from '@/test/utils/deterministic'

describe('CircuitBreaker', () => {

  describe('basic functionality', () => {
    it('executes successful function', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-success',
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      const result = await breaker.execute(async () => 'success')
      expect(result).toBe('success')
      expect(breaker.getState().state).toBe('CLOSED')
    })

    it('tracks consecutive successes', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-consecutive',
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      await breaker.execute(async () => '1')
      await breaker.execute(async () => '2')
      await breaker.execute(async () => '3')

      const state = breaker.getState()
      expect(state.state).toBe('CLOSED')
      expect(state.successes).toBe(3)
    })
  })

  describe('failure handling', () => {
    it('tracks failures without opening circuit immediately', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-failures',
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      // First 2 failures should not open circuit
      await expect(breaker.execute(async () => { throw new Error('fail 1') })).rejects.toThrow('fail 1')
      await expect(breaker.execute(async () => { throw new Error('fail 2') })).rejects.toThrow('fail 2')

      const state = breaker.getState()
      expect(state.state).toBe('CLOSED')
      expect(state.failures).toBe(2)
    })

    it('opens circuit after threshold failures', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-open',
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      // 3 failures should open circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => { throw new Error(`fail ${i}`) })
        ).rejects.toThrow()
      }

      const state = breaker.getState()
      expect(state.state).toBe('OPEN')
      expect(state.failures).toBe(3)
    })

    it('throws CircuitBreakerOpenError when circuit is open', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-open-error',
        failureThreshold: 1,
        resetTimeoutMs: 10000,
        halfOpenMaxCalls: 1,
      })

      // Open the circuit
      await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()

      // Next call should throw CircuitBreakerOpenError
      await expect(breaker.execute(async () => 'success')).rejects.toThrow(CircuitBreakerOpenError)
    })
  })

  describe('half-open state', () => {
    it('transitions to half-open after reset timeout', async () => {
      await withFakeTimers(async (vi) => {
        const breaker = new CircuitBreaker({
          name: 'test-half-open-transition',
          failureThreshold: 1,
          resetTimeoutMs: 1000,
          halfOpenMaxCalls: 1, // Use 1 so single success closes circuit
        })

        // Open the circuit
        await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()
        expect(breaker.getState().state).toBe('OPEN')

        // Advance time past reset timeout
        vi.advanceTimersByTime(1500)

        // Circuit should attempt reset (become half-open)
        // With halfOpenMaxCalls: 1, single success should close circuit
        await breaker.execute(async () => 'success')
        expect(breaker.getState().state).toBe('CLOSED')
      })
    })

    it('returns to open if half-open call fails', async () => {
      await withFakeTimers(async (vi) => {
        const breaker = new CircuitBreaker({
          name: 'test-half-open-fail',
          failureThreshold: 1,
          resetTimeoutMs: 1000,
          halfOpenMaxCalls: 2,
        })

        // Open the circuit
        await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()

        // Advance time past reset timeout
        vi.advanceTimersByTime(1500)

        // Half-open call fails
        await expect(breaker.execute(async () => { throw new Error('fail again') })).rejects.toThrow()
        expect(breaker.getState().state).toBe('OPEN')
      })
    })

    it('limits calls in half-open state', async () => {
      await withFakeTimers(async (vi) => {
        const breaker = new CircuitBreaker({
          name: 'test-half-open-limit',
          failureThreshold: 1,
          resetTimeoutMs: 1000,
          halfOpenMaxCalls: 1,
        })

        // Open the circuit by failing once
        await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()
        expect(breaker.getState().state).toBe('OPEN')

        // Advance time past reset timeout (this triggers transition to HALF_OPEN on next call)
        vi.advanceTimersByTime(1500)

        // After advancing timers, the next execute should work (circuit becomes HALF_OPEN, then CLOSED on success)
        // Wait for the async execution
        const result = await breaker.execute(async () => 'success')
        expect(result).toBe('success')

        // Circuit should be closed now
        expect(breaker.getState().state).toBe('CLOSED')
      })
    })
  })

  describe('reset functionality', () => {
    it('manually resets circuit to closed', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-reset',
        failureThreshold: 1,
        resetTimeoutMs: 10000,
        halfOpenMaxCalls: 1,
      })

      // Open the circuit
      await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()
      expect(breaker.getState().state).toBe('OPEN')

      // Manual reset
      breaker.reset()

      const state = breaker.getState()
      expect(state.state).toBe('CLOSED')
      expect(state.failures).toBe(0)
      expect(state.successes).toBe(0)

      // Should work again
      const result = await breaker.execute(async () => 'success')
      expect(result).toBe('success')
    })
  })

  describe('state reporting', () => {
    it('reports correct initial state', () => {
      const breaker = new CircuitBreaker({
        name: 'test-state',
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      const state = breaker.getState()
      expect(state.state).toBe('CLOSED')
      expect(state.failures).toBe(0)
      expect(state.successes).toBe(0)
    })

    it('tracks state changes correctly', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-state-changes',
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 1,
      })

      // Success
      await breaker.execute(async () => '1')
      expect(breaker.getState().successes).toBe(1)

      // Failures
      await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()
      await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()

      const state = breaker.getState()
      expect(state.state).toBe('OPEN')
      expect(state.failures).toBe(2)
    })
  })

  describe('withFallback', () => {
    it('returns function result when circuit is closed', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-wf-closed',
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      const result = await breaker.withFallback(async () => 'ok', async () => 'fallback')
      expect(result).toBe('ok')
    })

    it('returns fallback when circuit is OPEN', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-wf-open',
        failureThreshold: 1,
        resetTimeoutMs: 10_000,
        halfOpenMaxCalls: 1,
      })

      // Open the circuit
      await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()
      expect(breaker.getState().state).toBe('OPEN')

      const result = await breaker.withFallback(async () => 'ok', async () => 'fallback')
      expect(result).toBe('fallback')
    })

    it('propagates non-circuit errors without triggering fallback', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-wf-domain-err',
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      await expect(
        breaker.withFallback(async () => { throw new Error('domain error') }, async () => 'fallback')
      ).rejects.toThrow('domain error')
    })

    it('supports sync fallback factory', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-wf-sync-fallback',
        failureThreshold: 1,
        resetTimeoutMs: 10_000,
        halfOpenMaxCalls: 1,
      })

      await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()

      const result = await breaker.withFallback(async () => 'ok', () => 'sync-fallback')
      expect(result).toBe('sync-fallback')
    })
  })

  describe('error handling', () => {
    it('preserves original error type', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-error-type',
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      class CustomError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      await expect(
        breaker.execute(async () => { throw new CustomError('custom') })
      ).rejects.toThrow(CustomError)
    })

    it('rejects non-Error throws', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-non-error',
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 2,
      })

      await expect(
        breaker.execute(async () => { throw 'string error' })
      ).rejects.toThrow('string error')
    })
  })
})

describe('withTimeout', () => {
  it('resolves when the wrapped promise settles before timeout', async () => {
    const result = await withTimeout(Promise.resolve('done'), 5000, 'test-op')
    expect(result).toBe('done')
  })

  it('propagates rejection from the wrapped promise', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('upstream')), 5000, 'test-op')
    ).rejects.toThrow('upstream')
  })

  it('rejects with descriptive timeout error when promise is too slow', async () => {
    await withFakeTimers(async (vi) => {
      const neverResolves = new Promise<string>((resolve) => {
        setTimeout(() => resolve('late'), 5000)
      })
      const raced = withTimeout(neverResolves, 1000, 'slow-model')
      vi.advanceTimersByTime(1500)
      await expect(raced).rejects.toThrow('slow-model')
      await expect(raced).rejects.toThrow('1000ms')
    })
  })

  it('includes label in timeout error message', async () => {
    await withFakeTimers(async (vi) => {
      const pending = new Promise<string>((resolve) => {
        setTimeout(() => resolve('x'), 9999)
      })
      const raced = withTimeout(pending, 500, 'gemini.gemini-2.5-flash')
      vi.advanceTimersByTime(600)
      await expect(raced).rejects.toThrow('gemini.gemini-2.5-flash')
    })
  })
})
