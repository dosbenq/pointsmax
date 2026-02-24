-- ============================================================
-- PointsMax — Migration 015
-- Link health logging for affiliate URL monitoring
-- ============================================================

CREATE TABLE IF NOT EXISTS public.link_health_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      TEXT NOT NULL,
  card_id     UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  url         TEXT NOT NULL,
  status_code INT,
  ok          BOOLEAN NOT NULL,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_health_log_checked_at
  ON public.link_health_log (checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_link_health_log_run_id
  ON public.link_health_log (run_id);

CREATE INDEX IF NOT EXISTS idx_link_health_log_ok
  ON public.link_health_log (ok, checked_at DESC);
