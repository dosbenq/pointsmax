/**
 * Database Query Timeouts and Connection Management
 * Prevents resource exhaustion from hanging queries
 */

import { logError, logWarn } from './logger'

export interface QueryTimeoutConfig {
  defaultTimeoutMs: number
  slowQueryThresholdMs: number
  maxConcurrentQueries: number
}

const DEFAULT_CONFIG: QueryTimeoutConfig = {
  defaultTimeoutMs: 10000,     // 10 seconds default
  slowQueryThresholdMs: 5000,  // 5 seconds for warning
  maxConcurrentQueries: 50,    // Max concurrent queries
}

// Track concurrent queries
let activeQueries = 0

export function getActiveQueryCount(): number {
  return activeQueries
}

/**
 * Wraps a database query with timeout protection
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  options?: {
    timeoutMs?: number
    operationName?: string
    abortSignal?: AbortSignal
  }
): Promise<T> {
  const config = { ...DEFAULT_CONFIG, ...options }
  const timeoutMs = config.timeoutMs ?? DEFAULT_CONFIG.defaultTimeoutMs
  const operationName = options?.operationName ?? 'unnamed_query'

  // Check concurrent query limit
  if (activeQueries >= DEFAULT_CONFIG.maxConcurrentQueries) {
    throw new QueryTimeoutError(
      `Too many concurrent queries (${activeQueries}). Try again later.`
    )
  }

  activeQueries++
  const startTime = Date.now()

  try {
    // Create abortable promise
    const queryPromise = operation()

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new QueryTimeoutError(
          `Query '${operationName}' timed out after ${timeoutMs}ms`
        ))
      }, timeoutMs)

      // Clean up timer if aborted
      options?.abortSignal?.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new QueryTimeoutError(`Query '${operationName}' was aborted`))
      }, { once: true })
    })

    // Race between query and timeout
    const result = await Promise.race([queryPromise, timeoutPromise])

    const duration = Date.now() - startTime

    // Log slow queries
    if (duration > DEFAULT_CONFIG.slowQueryThresholdMs) {
      logWarn('slow_query_detected', {
        operation: operationName,
        duration_ms: duration,
        threshold_ms: DEFAULT_CONFIG.slowQueryThresholdMs,
      })
    }

    return result
  } catch (error) {
    const duration = Date.now() - startTime

    if (error instanceof QueryTimeoutError) {
      logError('query_timeout', {
        operation: operationName,
        timeout_ms: timeoutMs,
        duration_ms: duration,
      })
    }

    throw error
  } finally {
    activeQueries--
  }
}

export class QueryTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QueryTimeoutError'
  }
}

type CountOption = { count?: 'exact' | 'planned' | 'estimated' }

type QueryThen = (
  onfulfilled?: ((value: unknown) => unknown) | null,
  onrejected?: ((reason: unknown) => unknown) | null
) => Promise<unknown>

type SelectQueryBuilder = {
  then: QueryThen
}

type FromBuilder = {
  select: (columns: string, options?: CountOption) => SelectQueryBuilder
}

type SupabaseLikeClient = {
  from: (table: string) => FromBuilder
}

/**
 * Wrapper for Supabase queries with timeout
 */
export function createTimeoutWrapper(supabaseClient: SupabaseLikeClient) {
  return {
    from: (table: string) => {
      const builder = supabaseClient.from(table)
      const originalSelect = builder.select.bind(builder)

      builder.select = (columns: string, options?: CountOption) => {
        const queryBuilder = originalSelect(columns, options)
        const originalExecute = queryBuilder.then.bind(queryBuilder)

        // Wrap the promise execution with timeout
        const wrappedExecute: QueryThen = async (callback) => {
          return withTimeout(
            () => originalExecute(callback),
            {
              operationName: `select:${table}`,
              timeoutMs: 10000,
            }
          )
        }

        queryBuilder.then = wrappedExecute
        return queryBuilder
      }

      return builder
    },
  }
}
