-- ============================================================
-- PointsMax — Migration 028
-- Connected Wallet CW2: sync_status + error_code fields
--
-- Adds structured sync state columns to connected_accounts:
--
--   sync_status  — lifecycle state of the most recent sync attempt
--                  pending | syncing | ok | error | stale
--
--   error_code   — machine-readable code for the last failure
--                  auth_error | rate_limit | provider_error | unknown
--                  (null when sync_status = 'ok' or 'pending')
--
-- Design notes:
--   • last_synced_at and last_error are preserved from migration 027;
--     sync_status / error_code layer structured state on top of them.
--   • Stale computation is done at the application layer based on
--     last_synced_at + provider minSyncIntervalSeconds.
--   • Backwards-compatible: new columns have safe defaults.
--
-- Rollback:
--   ALTER TABLE public.connected_accounts
--     DROP COLUMN IF EXISTS sync_status,
--     DROP COLUMN IF EXISTS error_code;
-- ============================================================

-- ── Add sync_status ──────────────────────────────────────────────────────────

ALTER TABLE public.connected_accounts
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'syncing', 'ok', 'error', 'stale'));

-- ── Add error_code ───────────────────────────────────────────────────────────

ALTER TABLE public.connected_accounts
  ADD COLUMN IF NOT EXISTS error_code TEXT
    CHECK (error_code IN ('auth_error', 'rate_limit', 'provider_error', 'unknown'));

-- ── Index: active accounts needing sync, ordered by staleness ───────────────

CREATE INDEX IF NOT EXISTS idx_connected_accounts_sync_status
  ON public.connected_accounts (sync_status, last_synced_at NULLS FIRST)
  WHERE status = 'active';

-- ── Verification queries (run manually in Supabase SQL Editor) ────────────────
--
-- SELECT sync_status, COUNT(*) FROM public.connected_accounts GROUP BY 1;
-- SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'connected_accounts'
--     AND column_name IN ('sync_status', 'error_code');
-- ─────────────────────────────────────────────────────────────────────────────
