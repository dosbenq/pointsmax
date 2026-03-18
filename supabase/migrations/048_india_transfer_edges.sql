-- ============================================================
-- PointsMax — Migration 039
-- India transfer partner depth (additive, slug-gated)
-- ============================================================

-- HDFC Diners Club family
INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 2, 1, 1000, 1000, 48, 168, false, true,
  'HDFC Diners Club Rewards to KrisFlyer (conservative family default)'
FROM public.programs fp
JOIN public.programs tp ON tp.slug = 'krisflyer'
WHERE fp.slug = 'hdfc-diners-club-rewards'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 2, 1, 1000, 1000, 48, 168, false, true,
  'HDFC Diners Club Rewards to Club Vistara (conservative family default)'
FROM public.programs fp
JOIN public.programs tp ON tp.slug = 'club-vistara'
WHERE fp.slug = 'hdfc-diners-club-rewards'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 2, 1, 1000, 1000, 48, 168, false, true,
  'HDFC Diners Club Rewards to InterMiles (conservative family default)'
FROM public.programs fp
JOIN public.programs tp ON tp.slug = 'intermiles'
WHERE fp.slug = 'hdfc-diners-club-rewards'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

-- Axis Atlas / EDGE Miles
INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 1, 2, 500, 500, 48, 120, false, true,
  'Axis EDGE Miles to Air India Maharaja Club'
FROM public.programs fp
JOIN public.programs tp ON tp.slug IN ('air-india-maharaja-club', 'air-india')
WHERE fp.slug = 'axis-edge-miles'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 1, 2, 500, 500, 48, 120, false, true,
  'Axis EDGE Miles to KrisFlyer'
FROM public.programs fp
JOIN public.programs tp ON tp.slug = 'krisflyer'
WHERE fp.slug = 'axis-edge-miles'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 2, 1, 500, 500, 48, 120, false, true,
  'Axis EDGE Miles to Marriott Bonvoy'
FROM public.programs fp
JOIN public.programs tp ON tp.slug = 'marriott-bonvoy'
WHERE fp.slug = 'axis-edge-miles'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 1, 2, 500, 500, 48, 120, false, true,
  'Axis EDGE Miles to Qatar Privilege Club'
FROM public.programs fp
JOIN public.programs tp ON tp.slug = 'qatar-privilege-club'
WHERE fp.slug = 'axis-edge-miles'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 1, 2, 500, 500, 48, 120, false, true,
  'Axis EDGE Miles to United MileagePlus'
FROM public.programs fp
JOIN public.programs tp ON tp.slug = 'united-mileageplus'
WHERE fp.slug = 'axis-edge-miles'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

INSERT INTO public.transfer_partners (
  from_program_id, to_program_id, ratio_from, ratio_to,
  min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs,
  is_instant, is_active, notes
)
SELECT fp.id, tp.id, 1, 2, 500, 500, 48, 120, false, true,
  'Axis EDGE Miles to Flying Blue'
FROM public.programs fp
JOIN public.programs tp ON tp.slug = 'flying-blue'
WHERE fp.slug = 'axis-edge-miles'
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;
