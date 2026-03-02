-- ============================================================
-- PointsMax — Migration 027
-- Connected Wallet: connected_accounts + balance_snapshots
--
-- Adds core tables for the Connected Wallet feature (CW1):
--
--   connected_accounts  — OAuth / API-key connections to external
--                         loyalty providers (Amex, Chase, Citi, etc.)
--                         Encrypted tokens are stored in a separate
--                         vault; this table holds only non-secret
--                         metadata and a vault reference key.
--
--   balance_snapshots   — Immutable ledger of balance readings
--                         fetched via connectors, one row per fetch.
--                         Preserves the existing manual balance path
--                         (user_balances table) independently.
--
-- Design notes:
--   • Sensitive credential material (refresh tokens, API keys) is
--     encrypted at the application layer (see src/lib/connectors/
--     token-vault.ts) before being stored in token_vault_ref.
--   • Backwards-compatible: no existing tables are altered.
--   • Manual balances via user_balances remain untouched.
--
-- Rollback notes:
--   DROP TABLE IF EXISTS public.balance_snapshots;
--   DROP TABLE IF EXISTS public.connected_accounts;
-- ============================================================

-- ── connected_accounts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL
                    REFERENCES public.users(id) ON DELETE CASCADE,
  -- Short provider slug, e.g. 'amex', 'chase', 'citi', 'bilt', 'capital_one'
  provider        TEXT        NOT NULL,
  -- Human-readable display label set by user (nullable, UI default = provider)
  display_name    TEXT,
  -- Opaque reference key used to retrieve the encrypted token from the
  -- application-layer vault (never store raw credentials here)
  token_vault_ref TEXT        NOT NULL,
  -- Connection health: active | expired | revoked | error
  status          TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  -- ISO 8601 expiry of the access token (null = non-expiring API key)
  token_expires_at TIMESTAMPTZ,
  -- Scope string returned by the provider OAuth flow
  scopes          TEXT,
  -- Last time a balance fetch was attempted via this connection
  last_synced_at  TIMESTAMPTZ,
  -- Last sync error message (null if last sync was successful)
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active connection per user+provider; revoked/expired are kept for audit
  CONSTRAINT uq_connected_accounts_user_provider_active
    UNIQUE NULLS NOT DISTINCT (user_id, provider)
    -- Note: the uniqueness constraint intentionally covers all statuses so that
    -- re-authorisation must go through a deliberate revoke-then-reconnect flow.
);

-- RLS: users may only see and manage their own connected accounts
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own connected accounts"
  ON public.connected_accounts
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Service role has unrestricted access for sync workers and admin tooling
CREATE POLICY "Service role manages connected accounts"
  ON public.connected_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fast RLS subquery support (mirrors the pattern established in migration 025)
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id
  ON public.connected_accounts (user_id);

-- Lookup by provider (used by sync workers targeting a specific provider)
CREATE INDEX IF NOT EXISTS idx_connected_accounts_provider
  ON public.connected_accounts (provider, status);

-- Active connections eligible for the next sync cycle
CREATE INDEX IF NOT EXISTS idx_connected_accounts_active_sync
  ON public.connected_accounts (last_synced_at NULLS FIRST)
  WHERE status = 'active';

-- ── balance_snapshots ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.balance_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_account_id UUID       NOT NULL
                        REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL
                        REFERENCES public.users(id) ON DELETE CASCADE,
  -- The loyalty program whose balance was fetched
  program_id          UUID        NOT NULL
                        REFERENCES public.programs(id),
  -- Raw point / mile balance returned by the provider
  balance             BIGINT      NOT NULL CHECK (balance >= 0),
  -- Snapshot source: 'connector' (automated) | 'manual' (user-entered override)
  source              TEXT        NOT NULL DEFAULT 'connector'
                        CHECK (source IN ('connector', 'manual')),
  -- Provider-assigned transaction cursor for incremental fetches (nullable)
  provider_cursor     TEXT,
  -- Raw provider response for debugging / audit (stripped of credentials)
  raw_payload         JSONB,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: users see only their own snapshots
ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own balance snapshots"
  ON public.balance_snapshots
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service role manages balance snapshots"
  ON public.balance_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Primary time-series query: latest snapshots per user+program
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user_program_time
  ON public.balance_snapshots (user_id, program_id, fetched_at DESC);

-- Snapshot history for a single connected account (sync audit trail)
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_account_time
  ON public.balance_snapshots (connected_account_id, fetched_at DESC);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_connected_accounts_updated_at
  BEFORE UPDATE ON public.connected_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Verification queries (run manually in Supabase SQL Editor) ────────────────
--
-- SELECT COUNT(*) FROM public.connected_accounts;
-- SELECT COUNT(*) FROM public.balance_snapshots;
--
-- Check indexes exist:
-- SELECT indexname FROM pg_indexes
--   WHERE tablename IN ('connected_accounts', 'balance_snapshots')
--   ORDER BY tablename, indexname;
--
-- Check RLS is enabled:
-- SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE tablename IN ('connected_accounts', 'balance_snapshots');
-- ─────────────────────────────────────────────────────────────────────────────
