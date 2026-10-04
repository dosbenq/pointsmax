-- ============================================================
-- PointsMax — Migration 064
-- 019 tried to restrict active_bonuses to verified, active bonuses with
-- CREATE OR REPLACE VIEW, which Postgres rejects when the column list
-- changes ("cannot change name of view column"). The original view, which
-- ignores verification, therefore stayed in place, so auto-detected
-- (unverified) bonuses could reach the calculator. Recreate it properly.
-- ============================================================

DROP VIEW IF EXISTS public.active_bonuses;

CREATE VIEW public.active_bonuses AS
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

GRANT SELECT ON public.active_bonuses TO anon, authenticated;
