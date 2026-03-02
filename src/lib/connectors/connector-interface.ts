// ============================================================
// PointsMax — Provider Adapter Interface
//
// Every external loyalty-account connector must implement
// ProviderAdapter.  The interface is intentionally narrow:
// adapters are responsible only for credential validation and
// balance retrieval.  Token storage, scheduling, and DB writes
// are handled by the framework layer (connector-registry.ts,
// token-vault.ts, and the sync Inngest function).
// ============================================================

import type {
  ConnectorProvider,
  ConnectorContext,
  FetchBalanceResult,
  ProviderCapabilities,
} from '@/types/connectors'

// ─────────────────────────────────────────────
// PROVIDER ADAPTER CONTRACT
// ─────────────────────────────────────────────

/**
 * Contract that every provider adapter must satisfy.
 *
 * Implementations live in src/lib/connectors/adapters/<provider>.ts
 * and are registered with the ConnectorRegistry at startup.
 *
 * IMPORTANT: Adapters must never log or persist the accessToken
 * from ConnectorContext.  All credential handling goes through
 * token-vault.ts at the framework level.
 */
export interface ProviderAdapter {
  /** Stable provider identifier matching ConnectorProvider. */
  readonly providerId: ConnectorProvider

  /** Human-readable name shown in the UI (e.g. "American Express"). */
  readonly displayName: string

  /** Static capabilities declaration — no I/O, used by the scheduler. */
  readonly capabilities: ProviderCapabilities

  /**
   * Fetch current point balances for the connected account.
   *
   * Implementations should:
   *   1. Use context.accessToken for the API call.
   *   2. Strip credentials from any rawPayload before returning.
   *   3. Throw a ProviderError (or subclass) on recoverable failures.
   *   4. Throw a ProviderAuthError when the token is expired/revoked
   *      so the framework can update account.status accordingly.
   */
  fetchBalance(context: ConnectorContext): Promise<FetchBalanceResult>

  /**
   * Validate that the credentials in context are still usable.
   * Returns true if valid, false otherwise.
   * Must not throw unless there is an unexpected infrastructure error.
   */
  validateCredentials(context: ConnectorContext): Promise<boolean>
}

// ─────────────────────────────────────────────
// PROVIDER ERRORS
// ─────────────────────────────────────────────

/** Base class for all recoverable provider-side errors. */
export class ProviderError extends Error {
  constructor(
    public readonly providerId: ConnectorProvider,
    message: string,
  ) {
    super(`[${providerId}] ${message}`)
    this.name = 'ProviderError'
  }
}

/**
 * Thrown when provider credentials are expired or revoked.
 * The framework uses this signal to set account.status = 'expired' | 'revoked'.
 */
export class ProviderAuthError extends ProviderError {
  constructor(providerId: ConnectorProvider, message: string) {
    super(providerId, message)
    this.name = 'ProviderAuthError'
  }
}

/**
 * Thrown when the provider rate-limits the request.
 * The framework should back off and retry after retryAfterMs.
 */
export class ProviderRateLimitError extends ProviderError {
  constructor(
    providerId: ConnectorProvider,
    public readonly retryAfterMs: number,
  ) {
    super(providerId, `Rate limited — retry after ${retryAfterMs}ms`)
    this.name = 'ProviderRateLimitError'
  }
}
