/**
 * Circuit Breaker Pattern for External API Calls
 * Prevents cascading failures when external services are down
 */

import { logError, logInfo } from './logger'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerConfig {
  name: string
  failureThreshold: number
  resetTimeoutMs: number
  halfOpenMaxCalls: number
}

interface CircuitBreakerMetrics {
  failures: number
  successes: number
  lastFailureTime: number | null
  consecutiveSuccesses: number
  state: CircuitState
  halfOpenCalls: number
}

class CircuitBreakerStore {
  private circuits = new Map<string, CircuitBreakerMetrics>()

  get(name: string): CircuitBreakerMetrics | undefined {
    return this.circuits.get(name)
  }

  set(name: string, metrics: CircuitBreakerMetrics): void {
    this.circuits.set(name, metrics)
  }
}

const store = new CircuitBreakerStore()

export class CircuitBreaker {
  private config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      ...{
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        halfOpenMaxCalls: 3,
      },
      ...config,
    }
  }

  private getMetrics(): CircuitBreakerMetrics {
    const existing = store.get(this.config.name)
    if (existing) return existing

    const initial: CircuitBreakerMetrics = {
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      consecutiveSuccesses: 0,
      state: 'CLOSED',
      halfOpenCalls: 0,
    }
    store.set(this.config.name, initial)
    return initial
  }

  private updateMetrics(metrics: CircuitBreakerMetrics): void {
    store.set(this.config.name, metrics)
  }

  private shouldAttemptReset(metrics: CircuitBreakerMetrics): boolean {
    if (metrics.state !== 'OPEN') return false
    if (!metrics.lastFailureTime) return true
    return Date.now() - metrics.lastFailureTime >= this.config.resetTimeoutMs
  }

  private transitionTo(newState: CircuitState, metrics: CircuitBreakerMetrics): void {
    if (metrics.state === newState) return

    logInfo('circuit_breaker_state_change', {
      name: this.config.name,
      from: metrics.state,
      to: newState,
    })

    metrics.state = newState

    if (newState === 'HALF_OPEN') {
      metrics.halfOpenCalls = 0
      metrics.consecutiveSuccesses = 0
    }

    if (newState === 'CLOSED') {
      metrics.failures = 0
      metrics.consecutiveSuccesses = 0
    }

    this.updateMetrics(metrics)
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const metrics = this.getMetrics()

    // Check if circuit is OPEN
    if (metrics.state === 'OPEN') {
      if (this.shouldAttemptReset(metrics)) {
        this.transitionTo('HALF_OPEN', metrics)
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.config.name}' is OPEN - service temporarily unavailable`
        )
      }
    }

    // Limit half-open calls
    if (metrics.state === 'HALF_OPEN' && metrics.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker '${this.config.name}' is HALF_OPEN - max calls reached`
      )
    }

    if (metrics.state === 'HALF_OPEN') {
      metrics.halfOpenCalls++
      this.updateMetrics(metrics)
    }

    try {
      const result = await fn()

      // Record success
      metrics.consecutiveSuccesses++
      metrics.successes++

      // If in HALF_OPEN and enough consecutive successes, close the circuit
      if (metrics.state === 'HALF_OPEN' && metrics.consecutiveSuccesses >= this.config.halfOpenMaxCalls) {
        this.transitionTo('CLOSED', metrics)
      } else {
        this.updateMetrics(metrics)
      }

      return result
    } catch (error) {
      // Record failure
      metrics.failures++
      metrics.consecutiveSuccesses = 0
      metrics.lastFailureTime = Date.now()

      logError('circuit_breaker_failure', {
        name: this.config.name,
        failureCount: metrics.failures,
        error: error instanceof Error ? error.message : String(error),
      })

      // Open circuit if failure threshold reached
      if (metrics.failures >= this.config.failureThreshold) {
        this.transitionTo('OPEN', metrics)
      } else {
        this.updateMetrics(metrics)
      }

      throw error
    }
  }

  /**
   * Get current circuit state (for health checks)
   */
  getState(): { state: CircuitState; failures: number; successes: number } {
    const metrics = this.getMetrics()
    return {
      state: metrics.state,
      failures: metrics.failures,
      successes: metrics.successes,
    }
  }

  /**
   * Force reset circuit (for manual recovery)
   */
  reset(): void {
    logInfo('circuit_breaker_manual_reset', { name: this.config.name })
    const metrics = this.getMetrics()
    this.transitionTo('CLOSED', metrics)
  }

  /**
   * Execute with automatic fallback when circuit is OPEN.
   * Unlike execute(), this does NOT re-throw CircuitBreakerOpenError —
   * it calls fallbackFn() instead, enabling graceful degradation.
   */
  async withFallback<T>(fn: () => Promise<T>, fallbackFn: () => T | Promise<T>): Promise<T> {
    try {
      return await this.execute(fn)
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        return await fallbackFn()
      }
      throw err
    }
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CircuitBreakerOpenError'
  }
}

/**
 * Wraps a promise with a hard timeout.
 * Rejects with a descriptive error if the promise does not settle within `ms`.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`AI inference timeout: ${label} exceeded ${ms}ms`)),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

/**
 * Returns the AI inference timeout in ms.
 * Reads AI_INFERENCE_TIMEOUT_MS env var; defaults to 25 seconds.
 */
export function getAiInferenceTimeoutMs(): number {
  const raw = process.env.AI_INFERENCE_TIMEOUT_MS
  if (raw) {
    const parsed = parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return 25_000
}

// Pre-configured circuit breakers for external services
export const geminiCircuitBreaker = new CircuitBreaker({
  name: 'gemini-api',
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 2,
})

export const seatsAeroCircuitBreaker = new CircuitBreaker({
  name: 'seats-aero-api',
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxCalls: 3,
})

export const stripeCircuitBreaker = new CircuitBreaker({
  name: 'stripe-api',
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 3,
})
