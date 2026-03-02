// ============================================================
// RLS Index Audit Helpers
// Pure, side-effect-free definitions used by:
//   - scripts/check-rls-indexes.mjs  (static migration audit)
//   - src/lib/db/rls-index-audit.test.ts  (unit tests)
// ============================================================

export interface RlsIndexRequirement {
  /** Human-readable label */
  name: string
  /** Public schema table name */
  table: string
  /** Column the index covers */
  column: string
  /** Migration file(s) where the index should be defined */
  files: string[]
  /** Regex that must match the combined SQL of the above files */
  pattern: RegExp
  /** Why this index matters for RLS performance */
  notes: string
}

/**
 * Canonical list of indexes required to support RLS policy evaluation
 * efficiently. Each entry corresponds to a policy subquery of the form:
 *
 *   user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
 *
 * Without these indexes, Postgres falls back to a sequential scan on every
 * authenticated request, which degrades linearly with table size.
 */
export const RLS_INDEX_REQUIREMENTS: RlsIndexRequirement[] = [
  {
    name: 'users(auth_id) — UNIQUE constraint',
    table: 'users',
    column: 'auth_id',
    files: ['002_auth_preferences.sql'],
    pattern: /ALTER TABLE users ADD COLUMN auth_id\s+UUID\s+UNIQUE/i,
    notes: 'UNIQUE constraint creates an implicit btree index (migration 002)',
  },
  {
    name: 'idx_balances_user on user_balances(user_id)',
    table: 'user_balances',
    column: 'user_id',
    files: ['001_initial_schema.sql'],
    pattern: /CREATE INDEX\s+idx_balances_user\s+ON\s+user_balances\(user_id\)/i,
    notes: 'btree index from migration 001',
  },
  {
    name: 'user_preferences PRIMARY KEY on user_id',
    table: 'user_preferences',
    column: 'user_id',
    files: ['002_auth_preferences.sql'],
    pattern: /user_id\s+UUID\s+PRIMARY KEY/i,
    notes: 'PRIMARY KEY creates an implicit btree index (migration 002)',
  },
  {
    name: 'idx_alert_subscriptions_user_id on alert_subscriptions(user_id)',
    table: 'alert_subscriptions',
    column: 'user_id',
    files: ['025_rls_index_hardening.sql'],
    pattern: /CREATE INDEX IF NOT EXISTS\s+idx_alert_subscriptions_user_id/i,
    notes: 'partial btree WHERE user_id IS NOT NULL (migration 025)',
  },
  {
    name: 'idx_flight_watches_user_id on flight_watches(user_id)',
    table: 'flight_watches',
    column: 'user_id',
    files: ['025_rls_index_hardening.sql'],
    pattern: /CREATE INDEX IF NOT EXISTS\s+idx_flight_watches_user_id/i,
    notes: 'btree index from migration 025',
  },
  {
    name: 'idx_onboarding_email_log_unique on onboarding_email_log(user_id, email_kind)',
    table: 'onboarding_email_log',
    column: 'user_id',
    files: ['018_onboarding_email_log.sql'],
    pattern: /CREATE UNIQUE INDEX IF NOT EXISTS\s+idx_onboarding_email_log_unique/i,
    notes: 'composite unique index with user_id as leading column (migration 018)',
  },
]

/**
 * Check whether a given SQL string satisfies the index requirement pattern.
 * Returns true if the pattern matches anywhere in the SQL content.
 */
export function sqlSatisfiesRequirement(
  requirement: RlsIndexRequirement,
  combinedSql: string
): boolean {
  return requirement.pattern.test(combinedSql)
}

/**
 * Tables that have RLS enabled and use the shared user subquery pattern.
 * Used for documentation and cross-checking against policy lists.
 */
export const RLS_PROTECTED_USER_TABLES = [
  'user_balances',
  'user_preferences',
  'alert_subscriptions',
  'flight_watches',
] as const

export type RlsProtectedTable = (typeof RLS_PROTECTED_USER_TABLES)[number]
