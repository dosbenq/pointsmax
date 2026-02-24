-- ============================================================
-- PointsMax — Migration 016
-- Creator referral tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.creators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  platform    TEXT,
  profile_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS creator_slug TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_clicks_creator_slug_fkey'
  ) THEN
    ALTER TABLE public.affiliate_clicks
      ADD CONSTRAINT affiliate_clicks_creator_slug_fkey
      FOREIGN KEY (creator_slug) REFERENCES public.creators(slug) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_creator_slug
  ON public.affiliate_clicks (creator_slug, created_at DESC);
