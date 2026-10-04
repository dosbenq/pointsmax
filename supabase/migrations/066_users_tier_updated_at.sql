-- ============================================================
-- PointsMax — Migration 066
-- The Stripe webhook read and wrote users.updated_at, a column that never
-- existed, so subscription.updated/deleted events could not find the user
-- and cancellations never downgraded anyone. Track the Stripe event time
-- that last set the tier in a dedicated column.
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMPTZ;
