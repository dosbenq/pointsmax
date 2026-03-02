import { logError, logWarn } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// Retry with exponential backoff
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number
  /** Delay before the second attempt in ms (default: 500) */
  initialDelayMs?: number
  /** Multiplier applied to the delay after each failure (default: 2) */
  backoffMultiplier?: number
  /** Upper bound for computed delay in ms (default: 30 000) */
  maxDelayMs?: number
  /** Return false to stop retrying early (e.g. on a 4xx error) */
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calls `fn` up to `maxAttempts` times, applying exponential backoff between
 * failures.  Throws the last error if all attempts fail.
 *
 * Pass `_sleep` to inject a custom sleep function for unit tests.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  _sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3
  const initialDelayMs = options.initialDelayMs ?? 500
  const backoffMultiplier = options.backoffMultiplier ?? 2
  const maxDelayMs = options.maxDelayMs ?? 30_000
  const shouldRetry = options.shouldRetry ?? (() => true)

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const isLast = attempt === maxAttempts
      if (isLast || !shouldRetry(err, attempt)) {
        break
      }
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs,
      )
      logWarn('retry_with_backoff', {
        attempt,
        maxAttempts,
        delayMs,
        error: err instanceof Error ? err.message : String(err),
      })
      await _sleep(delayMs)
    }
  }

  throw lastError
}

// ─────────────────────────────────────────────────────────────────────────────
// Dead-Letter Queue (in-memory store; production persists to DB via migration)
// ─────────────────────────────────────────────────────────────────────────────

export interface DlqEntry {
  functionId: string
  eventName: string
  payload?: unknown
  errorMessage: string
  retryCount: number
  createdAt: string
}

function getDlqStore(): DlqEntry[] {
  const globalRef = globalThis as typeof globalThis & {
    __pointsmaxDlqStore?: DlqEntry[]
  }
  if (!globalRef.__pointsmaxDlqStore) {
    globalRef.__pointsmaxDlqStore = []
  }
  return globalRef.__pointsmaxDlqStore
}

/**
 * Records a failed job in the dead-letter queue.
 * In-memory store is used for warm serverless instances and tests.
 * The 026 migration creates a persistent `dead_letter_queue` table
 * for durable storage in production (written by the monitoring middleware).
 */
export function recordDlqEntry(entry: Omit<DlqEntry, 'createdAt'>): DlqEntry {
  const full: DlqEntry = { ...entry, createdAt: new Date().toISOString() }
  const store = getDlqStore()
  store.push(full)

  // Keep last 1 000 entries in memory to bound memory usage
  if (store.length > 1000) {
    store.splice(0, store.length - 1000)
  }

  logError('dlq_entry_recorded', {
    functionId: full.functionId,
    eventName: full.eventName,
    retryCount: full.retryCount,
    errorMessage: full.errorMessage,
  })
  return full
}

export function getDlqEntries(): DlqEntry[] {
  return [...getDlqStore()]
}

/** Exposed for unit tests — clears the in-memory DLQ store. */
export function _clearDlqStore(): void {
  const store = getDlqStore()
  store.splice(0, store.length)
}

// ─────────────────────────────────────────────────────────────────────────────
// Inngest retry configuration presets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard retry presets for Inngest function definitions.
 *
 * Usage:
 *   inngest.createFunction(
 *     { id: "my-fn", ...INNGEST_RETRY_CONFIG.financial },
 *     { cron: "…" },
 *     handler,
 *   )
 */
export const INNGEST_RETRY_CONFIG = {
  /** Most background jobs — 3 attempts with Inngest's default backoff */
  standard: { retries: 3 },
  /** Financial / bonus-critical jobs — 5 attempts */
  financial: { retries: 5 },
  /** One-shot notifications that must not repeat */
  noRetry: { retries: 0 },
} as const
