-- ============================================================
-- PointsMax — Migration 065
-- /api/analytics/affiliate-click has always inserted recommendation_mode and
-- program_id, but no migration created them, so every click insert failed
-- (three retries, then a logged error) and affiliate clicks went unrecorded.
-- ============================================================

ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS recommendation_mode TEXT;
ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS program_id UUID;
