-- ============================================================
-- PointsMax — Migration 026
-- Queue Durability: Dead-Letter Queue + Idempotency Keys
--
-- Adds two supporting tables for Week-2 reliability baseline:
--
--   dead_letter_queue   — durable log of Inngest jobs that exhausted
--                         all retry attempts, enabling manual inspection
--                         and replay.
--
--   idempotency_keys    — persists operation results keyed by an
--                         idempotency token so that retried or duplicate
--                         API / queue calls return the same outcome
--                         without re-executing the side-effectful logic.
--
-- Both tables are append-only logs; application code never updates rows.
-- Stale rows are removed by the scheduled cleanup functions or manual
-- TRUNCATE after inspection.
--
-- Rollback notes:
--   DROP TABLE IF EXISTS public.dead_letter_queue;
--   DROP TABLE IF EXISTS public.idempotency_keys;
-- ============================================================

-- ── Dead-Letter Queue ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Inngest function identifier (e.g. "bonus-curator")
  function_id    TEXT        NOT NULL,
  -- Inngest event name that triggered the function
  event_name     TEXT        NOT NULL,
  -- Full event payload for replay (may be null for lightweight entries)
  payload        JSONB,
  -- Last error message from the failed run
  error_message  TEXT        NOT NULL DEFAULT '',
  -- How many times the job was attempted before landing here
  retry_count    INTEGER     NOT NULL DEFAULT 0,
  -- Status: pending (needs review) | retrying | resolved
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'retrying', 'resolved')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempted_at TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ,
  resolved_by    TEXT
);

-- Fast lookup of unresolved entries for the ops dashboard
CREATE INDEX IF NOT EXISTS idx_dlq_status_created
  ON public.dead_letter_queue (status, created_at DESC)
  WHERE status IN ('pending', 'retrying');

-- Lookup by function for incident triage
CREATE INDEX IF NOT EXISTS idx_dlq_function_id
  ON public.dead_letter_queue (function_id, created_at DESC);

-- RLS: service-role writes; no user-level access
ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Allow service-role (admin client) full access; deny anon/authenticated
CREATE POLICY "Service role manages dead letter queue"
  ON public.dead_letter_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Idempotency Keys ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  -- Stable hash key: "idempotent:<namespace>:<sha256-prefix>"
  key            TEXT        PRIMARY KEY,
  -- pending | completed | failed
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'failed')),
  -- Serialised result data (set on completion)
  response_data  JSONB,
  -- Error detail (set on failure, kept for observability)
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Lookup index for active idempotency checks.
-- Avoid volatile predicates (e.g. NOW()) in index definitions for Postgres compatibility.
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key_status_expires
  ON public.idempotency_keys (key, status, expires_at);

-- Cleanup index used by the scheduled purge job
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
  ON public.idempotency_keys (expires_at);

-- RLS: service-role writes; no user-level access
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages idempotency keys"
  ON public.idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Maintenance helper ────────────────────────────────────────────────────────
-- Called by a scheduled cron to keep the table small.
-- Returns the number of rows removed.
CREATE OR REPLACE FUNCTION public.purge_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at <= NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually in Supabase SQL Editor)
--
-- SELECT COUNT(*) FROM public.dead_letter_queue;
-- SELECT COUNT(*) FROM public.idempotency_keys;
-- SELECT public.purge_expired_idempotency_keys();
-- ──────────────────────────────────────────────────────────────────────────────
