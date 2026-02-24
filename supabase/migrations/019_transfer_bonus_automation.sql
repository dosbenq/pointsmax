-- ============================================================
-- PointsMax — Migration 019
-- Transfer bonus automation support + site stats view
-- ============================================================

ALTER TABLE public.transfer_bonuses
  ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.transfer_bonuses
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.transfer_bonuses
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.transfer_bonuses
  ADD COLUMN IF NOT EXISTS source_url TEXT;

UPDATE public.transfer_bonuses
SET verified = COALESCE(is_verified, false)
WHERE verified IS DISTINCT FROM COALESCE(is_verified, false);

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS best_uses TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS transfer_partners JSONB;

CREATE OR REPLACE VIEW public.active_bonuses AS
  SELECT
    tb.*,
    tp.from_program_id,
    tp.to_program_id,
    tp.ratio_from,
    tp.ratio_to,
    fp.name  AS from_program_name,
    fp.slug  AS from_program_slug,
    tp2.name AS to_program_name,
    tp2.slug AS to_program_slug,
    (CURRENT_DATE BETWEEN tb.start_date AND tb.end_date) AS is_active_now
  FROM public.transfer_bonuses tb
  JOIN public.transfer_partners tp  ON tp.id  = tb.transfer_partner_id
  JOIN public.programs fp            ON fp.id  = tp.from_program_id
  JOIN public.programs tp2           ON tp2.id = tp.to_program_id
  WHERE CURRENT_DATE BETWEEN tb.start_date AND tb.end_date
    AND COALESCE(tb.active, true) = true
    AND (COALESCE(tb.verified, false) = true OR COALESCE(tb.is_verified, false) = true);

CREATE OR REPLACE VIEW public.site_stats AS
SELECT
  (SELECT COUNT(*)::BIGINT FROM public.users) AS user_count,
  COALESCE((SELECT SUM(balance)::BIGINT FROM public.user_balances), 0::BIGINT) AS tracked_points,
  COALESCE((
    SELECT SUM(
      CASE
        WHEN (trip_data->>'total_value_cents') ~ '^[0-9]+$'
          THEN (trip_data->>'total_value_cents')::BIGINT
        ELSE 0
      END
    )::BIGINT
    FROM public.shared_trips
  ), 0::BIGINT) AS optimized_value_cents;
