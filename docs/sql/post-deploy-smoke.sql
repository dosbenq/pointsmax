-- Post-deploy operational checks
-- Run after smoke:prod to verify DB-side effects

-- 1) India cards available
SELECT geography, currency, count(*) AS cards
FROM public.cards
GROUP BY geography, currency
ORDER BY geography, currency;

-- 2) Affiliate click writes occurring
SELECT source_page, count(*) AS clicks
FROM public.affiliate_clicks
WHERE created_at > now() - interval '24 hours'
GROUP BY source_page
ORDER BY clicks DESC;

-- 3) Valuation cron inserted rows today
SELECT source, effective_date, count(*) AS rows
FROM public.valuations
WHERE effective_date = current_date
GROUP BY source, effective_date
ORDER BY source;

-- 4) Alert subscriptions created recently
SELECT count(*) AS recent_alert_subscriptions
FROM public.alert_subscriptions
WHERE created_at > now() - interval '24 hours';

-- 5) Flight watches created recently
SELECT count(*) AS recent_flight_watches
FROM public.flight_watches
WHERE created_at > now() - interval '24 hours';
