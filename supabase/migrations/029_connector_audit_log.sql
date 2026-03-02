-- ============================================================
-- PointsMax — Migration 029
-- Connected Wallet CW3: Connector Audit Log
--
-- Adds an immutable audit trail for all connected-account
-- lifecycle events: connect, disconnect, sync, manual_override,
-- delete, token_revoke, auth_error.
--
-- Design notes:
--   • account_id uses ON DELETE SET NULL so audit rows survive
--     even after the connected account is hard-deleted.
--   • provider is denormalised onto the row so the audit trail
--     remains meaningful after account deletion.
--   • Rows are append-only by design; the RLS policy grants
--     SELECT to authenticated users but no INSERT/UPDATE/DELETE.
--     Writes go through the service role (server-side routes).
--   • metadata JSONB holds event-specific context stripped of
--     any credential material.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.connector_audit_log;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.connector_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL
                REFERENCES public.users(id) ON DELETE CASCADE,
  -- Nullable so rows survive account hard-delete
  account_id  UUID
                REFERENCES public.connected_accounts(id) ON DELETE SET NULL,
  -- Denormalised provider slug (retained after account deletion)
  provider    TEXT        NOT NULL,
  -- Lifecycle event kind
  event_type  TEXT        NOT NULL
                CHECK (event_type IN (
                  'connect',
                  'disconnect',
                  'sync',
                  'manual_override',
                  'delete',
                  'token_revoke',
                  'auth_error'
                )),
  -- Who triggered the event
  actor       TEXT        NOT NULL DEFAULT 'user'
                CHECK (actor IN ('user', 'system', 'admin')),
  -- Stripped event-specific context (no credential material)
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.connector_audit_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read their own audit rows
CREATE POLICY "Users view own connector audit log"
  ON public.connector_audit_log
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Service role has full access (server-side write path)
CREATE POLICY "Service role manages connector audit log"
  ON public.connector_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary user timeline query
CREATE INDEX IF NOT EXISTS idx_connector_audit_log_user_time
  ON public.connector_audit_log (user_id, created_at DESC);

-- Per-account audit history (account_id may be NULL after deletion)
CREATE INDEX IF NOT EXISTS idx_connector_audit_log_account_time
  ON public.connector_audit_log (account_id, created_at DESC)
  WHERE account_id IS NOT NULL;

-- Event-type filter (e.g. "show me all disconnects")
CREATE INDEX IF NOT EXISTS idx_connector_audit_log_event_type
  ON public.connector_audit_log (event_type, created_at DESC);

-- ── Verification queries (run manually in Supabase SQL Editor) ────────────────
--
-- SELECT event_type, COUNT(*) FROM public.connector_audit_log GROUP BY 1;
--
-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename = 'connector_audit_log';
-- ─────────────────────────────────────────────────────────────────────────────
