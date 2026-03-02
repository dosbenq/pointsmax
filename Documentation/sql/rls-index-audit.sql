-- ============================================================
-- PointsMax — RLS Index Coverage Audit
-- Run in Supabase SQL Editor to check all RLS-supporting index coverage.
--
-- Reports three result columns per table:
--   table_name   — the RLS-protected table
--   index_name   — the expected supporting index
--   status       — 'present' | 'missing'
-- ============================================================

WITH required_indexes (table_name, index_name, notes) AS (
  VALUES
    -- users: auth_id lookup in the shared subquery
    -- Covered by UNIQUE constraint added in migration 002
    ('users',               'users_auth_id_key',                  'UNIQUE constraint from migration 002'),
    -- user_balances: user_id filter in "Users manage own balances" policy
    ('user_balances',       'idx_balances_user',                  'btree from migration 001'),
    -- user_preferences: PRIMARY KEY is the user_id lookup
    ('user_preferences',    'user_preferences_pkey',              'PRIMARY KEY from migration 002'),
    -- alert_subscriptions: user_id filter in "Users manage own alert subscriptions" policy
    -- nullable column → partial index WHERE user_id IS NOT NULL
    ('alert_subscriptions', 'idx_alert_subscriptions_user_id',    'partial btree from migration 025'),
    -- flight_watches: user_id filter in "Users manage own flight watches" policy
    ('flight_watches',      'idx_flight_watches_user_id',         'btree from migration 025'),
    -- onboarding_email_log: no RLS policy but user_id lookup covered by composite unique
    ('onboarding_email_log','idx_onboarding_email_log_unique',    'composite unique from migration 018')
),
present_indexes AS (
  SELECT
    t.relname  AS table_name,
    i.relname  AS index_name
  FROM pg_index ix
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
)
SELECT
  r.table_name,
  r.index_name,
  CASE
    WHEN p.index_name IS NOT NULL THEN 'present'
    ELSE 'MISSING'
  END AS status,
  r.notes
FROM required_indexes r
LEFT JOIN present_indexes p
       ON p.table_name  = r.table_name
      AND p.index_name  = r.index_name
ORDER BY r.table_name;

-- ──────────────────────────────────────────────────────────────────
-- Full RLS policy inventory (cross-check with index coverage)
-- ──────────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual AS using_expr,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
