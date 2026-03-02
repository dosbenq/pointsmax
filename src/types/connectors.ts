// ============================================================
// PointsMax — Connector Types
// TypeScript mirror of the connected_accounts / balance_snapshots
// schema plus domain types used by the connector framework.
// ============================================================

// ─────────────────────────────────────────────
// ENUMERATIONS
// ─────────────────────────────────────────────

/** Supported external loyalty-account providers. */
export type ConnectorProvider =
  | 'amex'
  | 'chase'
  | 'citi'
  | 'bilt'
  | 'capital_one'
  | 'wells_fargo'
  | 'bank_of_america'
  | 'us_bank'
  | 'discover'
  | 'barclays'

/** Connection lifecycle status stored in connected_accounts.status. */
export type ConnectedAccountStatus = 'active' | 'expired' | 'revoked' | 'error'

/** Sync job lifecycle state stored in connected_accounts.sync_status. */
export type SyncStatus = 'pending' | 'syncing' | 'ok' | 'error' | 'stale'

/** Machine-readable error code for the last failed sync. */
export type SyncErrorCode = 'auth_error' | 'rate_limit' | 'provider_error' | 'unknown'

/** Origin of a balance snapshot row. */
export type BalanceSnapshotSource = 'connector' | 'manual'

// ─────────────────────────────────────────────
// RAW TABLE ROWS (match DB columns exactly)
// ─────────────────────────────────────────────

export interface ConnectedAccount {
  id: string
  user_id: string
  provider: ConnectorProvider
  display_name: string | null
  /** Opaque vault reference key — never contains raw credentials. */
  token_vault_ref: string
  status: ConnectedAccountStatus
  token_expires_at: string | null
  scopes: string | null
  last_synced_at: string | null
  last_error: string | null
  /** Structured sync lifecycle state (added in migration 028). */
  sync_status: SyncStatus
  /** Machine-readable code for the last sync failure (added in migration 028). */
  error_code: SyncErrorCode | null
  created_at: string
  updated_at: string
}

export interface BalanceSnapshot {
  id: string
  connected_account_id: string
  user_id: string
  program_id: string
  balance: number
  source: BalanceSnapshotSource
  provider_cursor: string | null
  raw_payload: Record<string, unknown> | null
  fetched_at: string
}

// ─────────────────────────────────────────────
// CONNECTOR FRAMEWORK DOMAIN TYPES
// ─────────────────────────────────────────────

/**
 * Runtime context passed to every ProviderAdapter method.
 * Contains the decrypted credential — never persisted or logged.
 */
export interface ConnectorContext {
  /** Decrypted access token / API key retrieved from the vault. */
  readonly accessToken: string
  /** Supabase user UUID for the account being synced. */
  readonly userId: string
  /** The connected account record being operated on. */
  readonly account: ConnectedAccount
}

/** Structured result from a successful balance fetch. */
export interface FetchBalanceResult {
  /** Map of program_id → point balance */
  balances: Record<string, number>
  /** Opaque cursor for the next incremental fetch (null = full refresh). */
  cursor: string | null
  /**
   * Stripped provider response for audit storage.
   * Must NOT contain credential material.
   */
  rawPayload?: Record<string, unknown>
}

/** Metadata describing a provider's capabilities. */
export interface ProviderCapabilities {
  /** Whether the provider supports incremental balance fetches via a cursor. */
  supportsIncrementalSync: boolean
  /** Whether the provider requires an OAuth flow (vs static API key). */
  requiresOAuth: boolean
  /** Minimum seconds between fetches (to respect provider rate limits). */
  minSyncIntervalSeconds: number
}

// ─────────────────────────────────────────────
// VAULT TYPES
// ─────────────────────────────────────────────

/**
 * An encrypted credential bundle stored by the token vault.
 * The serialised form of this is what goes into token_vault_ref.
 */
export interface VaultEntry {
  /** AES-256-GCM ciphertext, base64-encoded. */
  ciphertext: string
  /** GCM initialisation vector, base64-encoded. */
  iv: string
  /** GCM authentication tag, base64-encoded. */
  tag: string
}
