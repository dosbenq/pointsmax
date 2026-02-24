-- ============================================================
-- PointsMax — Migration 018
-- Onboarding drip delivery dedupe/logging
-- ============================================================

CREATE TABLE IF NOT EXISTS public.onboarding_email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  email_kind  TEXT NOT NULL, -- welcome, day2, day7
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata    JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_email_log_unique
  ON public.onboarding_email_log (user_id, email_kind);

CREATE INDEX IF NOT EXISTS idx_onboarding_email_log_sent_at
  ON public.onboarding_email_log (sent_at DESC);
