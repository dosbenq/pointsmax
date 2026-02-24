import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from './circuit-breaker'

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

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
      const breaker = new CircuitBreaker({
        name: `test-half-open-${Date.now()}`,
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

    it('returns to open if half-open call fails', async () => {
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

    it('limits calls in half-open state', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-half-open-limit',
        failureThreshold: 1,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 1,
      })

      // Open the circuit
      await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow()

      // Advance time past reset timeout
      vi.advanceTimersByTime(1500)

      // First half-open call
      await breaker.execute(async () => 'success')

      // Circuit should be closed now
      expect(breaker.getState().state).toBe('CLOSED')
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
