-- ============================================================
-- PointsMax — Migration 038
-- Runtime-extensible program aliases for CSV / statement import
-- ============================================================

CREATE TABLE IF NOT EXISTS public.program_name_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_slug text NOT NULL REFERENCES public.programs(slug) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alias)
);

CREATE INDEX IF NOT EXISTS idx_program_name_aliases_slug
  ON public.program_name_aliases(program_slug);

ALTER TABLE public.program_name_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads program_name_aliases" ON public.program_name_aliases;
CREATE POLICY "Public reads program_name_aliases"
  ON public.program_name_aliases FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role manages program_name_aliases" ON public.program_name_aliases;
CREATE POLICY "Service role manages program_name_aliases"
  ON public.program_name_aliases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.program_name_aliases (program_slug, alias)
SELECT programs.slug, seed.alias
FROM (
  VALUES
    ('chase-ultimate-rewards', 'chase ur'),
    ('chase-ultimate-rewards', 'chase ultimate rewards'),
    ('chase-ultimate-rewards', 'chase sapphire'),
    ('amex-membership-rewards', 'amex mr'),
    ('amex-membership-rewards', 'membership rewards'),
    ('amex-membership-rewards', 'american express'),
    ('citi-thankyou', 'citi thankyou'),
    ('citi-thankyou', 'thankyou points'),
    ('citi-thankyou-rewards', 'citi thankyou'),
    ('citi-thankyou-rewards', 'thankyou points'),
    ('capital-one-miles', 'capital one'),
    ('capital-one-miles', 'venture miles'),
    ('bilt-rewards', 'bilt'),
    ('united-mileageplus', 'united'),
    ('delta-skymiles', 'delta'),
    ('world-of-hyatt', 'hyatt'),
    ('marriott-bonvoy', 'bonvoy'),
    ('hilton-honors', 'hilton'),
    ('hdfc-reward-points', 'hdfc bank'),
    ('hdfc-smartbuy-rewards', 'hdfc smartbuy'),
    ('hdfc-diners-club-rewards', 'hdfc diners'),
    ('hdfc-regalia-rewards', 'hdfc regalia'),
    ('axis-edge', 'axis bank'),
    ('axis-edge-rewards', 'axis bank'),
    ('axis-edge-rewards', 'axis edge'),
    ('axis-edge-miles', 'axis atlas'),
    ('icici-payback', 'icici payback'),
    ('icici-rewards', 'icici bank'),
    ('air-india', 'air india'),
    ('air-india-maharaja-club', 'air india'),
    ('air-india-maharaja-club', 'maharaja club'),
    ('indigo-6e', 'indigo'),
    ('indigo-bluchip', 'indigo'),
    ('indigo-bluchip', 'bluchip'),
    ('amex-india-mr', 'amex india'),
    ('amex-membership-rewards-india', 'amex india'),
    ('amex-membership-rewards-india', 'american express india'),
    ('krisflyer', 'singapore airlines'),
    ('aeroplan', 'air canada')
) AS seed(program_slug, alias)
JOIN public.programs ON programs.slug = seed.program_slug
ON CONFLICT (alias) DO NOTHING;
