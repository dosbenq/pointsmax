-- ============================================================
-- PointsMax — Migration 022
-- Affiliate analytics hardening: add rank and region to clicks
-- ============================================================

ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS rank INTEGER,
  ADD COLUMN IF NOT EXISTS region TEXT;

-- Index for better grouping in admin stats
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_region ON public.affiliate_clicks (region);
