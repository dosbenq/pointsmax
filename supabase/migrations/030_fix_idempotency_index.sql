-- ============================================================
-- PointsMax — Migration 030
-- Fix idempotency lookup index for Postgres compatibility
--
-- Replaces any prior live-partial index pattern that may have used
-- volatile predicates with a stable composite lookup index.
-- ============================================================

DROP INDEX IF EXISTS public.idx_idempotency_keys_live;
DROP INDEX IF EXISTS public.idx_idempotency_keys_key_status_expires;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key_status_expires
  ON public.idempotency_keys (key, status, expires_at);

