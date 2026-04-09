// ============================================================
// PointsMax — Sync Orchestrator (CW2)
//
// Orchestrates per-account balance sync with:
//   • Bounded retry + exponential backoff
//   • Dead-letter queue for exhausted jobs
//   • Structured sync_status / error_code persistence
//   • Stale detection based on configurable policy
// ============================================================

import type { ConnectedAccount, ConnectorContext, FetchBalanceResult } from '@/types/connectors'
import type { SyncErrorCode } from '@/types/connectors'
import { ProviderAuthError, ProviderRateLimitError } from './connector-interface'
import type { ProviderAdapter } from './connector-interface'
import { retryWithBackoff } from '@/lib/queue-durability'
import { recordDlqEntry } from '@/lib/queue-durability'
import { logInfo, logError, logWarn } from '@/lib/logger'

// ─────────────────────────────────────────────
// POLICY CONSTANTS
// ─────────────────────────────────────────────

/**
 * Operational thresholds for the sync orchestrator.
 *
 * maxAttempts       — Hard cap on retry attempts (no infinite loops).
 * initialDelayMs    — Delay before the second attempt.
 * backoffMultiplier — Delay multiplier per failure.
 * maxDelayMs        — Upper bound on computed delay.
 * staleThresholdMs  — Age of last_synced_at after which an account is
 *                     considered stale (default 4 h).
 */
export const SYNC_POLICY = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 30_000,
  staleThresholdMs: 4 * 60 * 60 * 1000, // 4 hours
} as const

// ─────────────────────────────────────────────
// PERSISTENCE CALLBACKS
// ─────────────────────────────────────────────

/**
 * Injectable persistence layer for sync state transitions.
 * All methods must not throw — errors are swallowed and logged.
 *
 * Production implementations write to Supabase.
 * Tests inject in-memory stubs.
 */
export interface SyncPersistence {
  getAccount?(accountId: string): Promise<{ data: { sync_status?: string } | null }>
  markSyncing(accountId: string): Promise<void>
  markSuccess(accountId: string, result: FetchBalanceResult): Promise<void>
  markError(
    accountId: string,
    errorCode: SyncErrorCode,
    errorMessage: string,
  ): Promise<void>
  markAuthError(accountId: string): Promise<void>
}

// ─────────────────────────────────────────────
// RESULT TYPES
// ─────────────────────────────────────────────

export type SyncOutcome =
  | { status: 'ok'; result: FetchBalanceResult }
  | { status: 'auth_error'; message: string }
  | { status: 'error'; errorCode: SyncErrorCode; message: string; attempts: number }

// ─────────────────────────────────────────────
// STALE DETECTION
// ─────────────────────────────────────────────

/**
 * Returns true if the account's last sync is older than
 * `thresholdMs` (defaults to SYNC_POLICY.staleThresholdMs).
 *
 * Accounts that have never synced (last_synced_at = null) are
 * always considered stale.
 */
export function isAccountStale(
  account: Pick<ConnectedAccount, 'last_synced_at'>,
  thresholdMs: number = SYNC_POLICY.staleThresholdMs,
  now: Date = new Date(),
): boolean {
  if (!account.last_synced_at) return true
  const ageMs = now.getTime() - new Date(account.last_synced_at).getTime()
  return ageMs >= thresholdMs
}

// ─────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────

/**
 * Runs a full sync cycle for a single connected account.
 *
 * Flow:
 *  1. Calls persistence.markSyncing()
 *  2. Calls adapter.fetchBalance() with bounded retry + backoff
 *     — ProviderAuthError → no retry, markAuthError(), return outcome
 *     — ProviderRateLimitError → respects retryAfterMs via shouldRetry
 *     — Other errors → retry up to maxAttempts
 *  3. On success  → persistence.markSuccess()
 *  4. On exhaustion → persistence.markError() + DLQ entry
 *
 * Pass `_sleep` to inject a custom sleep function for unit tests.
 */
export async function runAccountSync(
  adapter: ProviderAdapter,
  context: ConnectorContext,
  persistence: SyncPersistence,
  _sleep?: (ms: number) => Promise<void>,
): Promise<SyncOutcome> {
  const { account } = context
  const accountId = account.id

  // Check if already syncing (optimistic lock)
  if (persistence.getAccount) {
    const { data: existingAccount } = await persistence.getAccount(accountId)
    if (existingAccount?.sync_status === 'syncing') {
      logWarn('sync_already_in_progress', { accountId })
      return { status: 'error', errorCode: 'unknown' as SyncErrorCode, message: 'Sync already in progress', attempts: 0 }
    }
  }

  logInfo('sync_started', { accountId, provider: account.provider })

  await persistence.markSyncing(accountId)

  // Track whether we hit a rate-limit so we can set the right error code
  let lastErrorCode: SyncErrorCode = 'unknown'
  let attempts = 0

  try {
    const result = await retryWithBackoff(
      async () => {
        attempts++
        return adapter.fetchBalance(context)
      },
      {
        maxAttempts: SYNC_POLICY.maxAttempts,
        initialDelayMs: SYNC_POLICY.initialDelayMs,
        backoffMultiplier: SYNC_POLICY.backoffMultiplier,
        maxDelayMs: SYNC_POLICY.maxDelayMs,
        shouldRetry: (err) => {
          if (err instanceof ProviderAuthError) {
            // Auth errors are not retryable — credentials need re-authorisation
            lastErrorCode = 'auth_error'
            return false
          }
          if (err instanceof ProviderRateLimitError) {
            lastErrorCode = 'rate_limit'
            return true
          }
          if (err instanceof Error) {
            lastErrorCode = 'provider_error'
          }
          return true
        },
      },
      _sleep,
    )

    await persistence.markSuccess(accountId, result)
    logInfo('sync_success', { accountId, provider: account.provider })
    return { status: 'ok', result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (err instanceof ProviderAuthError) {
      await persistence.markAuthError(accountId)
      logError('sync_auth_error', { accountId, provider: account.provider, message })
      return { status: 'auth_error', message }
    }

    // All retries exhausted — record in DLQ (no silent failures)
    recordDlqEntry({
      functionId: 'sync-orchestrator',
      eventName: `connector.sync.${account.provider}`,
      payload: { accountId, provider: account.provider },
      errorMessage: message,
      retryCount: attempts,
    })

    await persistence.markError(accountId, lastErrorCode, message)
    logError('sync_exhausted', {
      accountId,
      provider: account.provider,
      errorCode: lastErrorCode,
      attempts,
      message,
    })
    return { status: 'error', errorCode: lastErrorCode, message, attempts }
  }
}
