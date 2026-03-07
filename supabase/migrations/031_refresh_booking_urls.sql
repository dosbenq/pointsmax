-- Normalize booking URL slugs and repair stale destinations.

UPDATE public.booking_urls
SET program_slug = 'citi-thankyou',
    updated_at = now()
WHERE program_slug = 'citi-ty';

UPDATE public.booking_urls
SET label = 'World of Hyatt award search',
    url = 'https://world.hyatt.com/content/gp/en/rewards.html',
    updated_at = now()
WHERE program_slug = 'hyatt';

UPDATE public.booking_urls
SET url = 'https://www.aeroplan.com/',
    updated_at = now()
WHERE program_slug = 'aeroplan';

UPDATE public.booking_urls
SET url = 'https://www.axisbank.com/axis-edge-rewards/',
    updated_at = now()
WHERE program_slug = 'axis-edge';

INSERT INTO public.booking_urls (program_slug, label, url, region, sort_order, is_active)
SELECT 'choice', 'Choice Privileges', 'https://www.choicehotels.com/choice-privileges', 'global', 125, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_urls WHERE program_slug = 'choice' AND region = 'global'
);

INSERT INTO public.booking_urls (program_slug, label, url, region, sort_order, is_active)
SELECT 'wyndham', 'Wyndham Rewards', 'https://www.wyndhamhotels.com/wyndham-rewards/redeem', 'global', 126, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_urls WHERE program_slug = 'wyndham' AND region = 'global'
);
