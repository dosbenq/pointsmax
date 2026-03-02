-- ============================================================
-- PointsMax — Migration 025
-- RLS Performance Hardening: Missing index coverage
--
-- Adds btree indexes required for efficient row-level security
-- policy evaluation on user-linked tables. The shared RLS
-- subquery pattern across all user policies is:
--
--   user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
--
-- This requires fast index lookups on:
--   1. users(auth_id)            — covered by UNIQUE constraint (migration 002)
--   2. <table>(user_id)          — needed on each RLS-protected table
--
-- Pre-025 gap analysis:
--   users(auth_id)                — covered (UNIQUE constraint, migration 002)
--   user_balances(user_id)        — covered (idx_balances_user, migration 001)
--   user_preferences(user_id)     — covered (PRIMARY KEY, migration 002)
--   alert_subscriptions(user_id)  — MISSING ← added here
--   flight_watches(user_id)       — MISSING ← added here
--   onboarding_email_log(user_id) — covered (idx_onboarding_email_log_unique
--                                    leading col, migration 018)
--
-- No destructive changes. All indexes use IF NOT EXISTS.
-- ============================================================

-- alert_subscriptions: user_id is nullable (guests have no user_id).
-- Partial index on non-null rows is the optimal choice — it is used
-- by the "Users manage own alert subscriptions" RLS policy (migration 009).
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user_id
  ON public.alert_subscriptions(user_id)
  WHERE user_id IS NOT NULL;

-- flight_watches: user_id is NOT NULL, so a plain btree index suffices.
-- Used by the "Users manage own flight watches" RLS policy (migration 010).
CREATE INDEX IF NOT EXISTS idx_flight_watches_user_id
  ON public.flight_watches(user_id);

-- ──────────────────────────────────────────────────────────────────
-- Query plan verification (run manually in Supabase SQL Editor)
--
-- BEFORE idx_alert_subscriptions_user_id:
--   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.alert_subscriptions
--   WHERE user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid());
--   → Seq Scan on alert_subscriptions  (cost=8.29..16.43 rows=1 width=…)
--         Filter: (user_id = $1)
--
-- AFTER idx_alert_subscriptions_user_id:
--   → Index Scan using idx_alert_subscriptions_user_id on alert_subscriptions
--         Index Cond: (user_id = $1)
--
-- BEFORE idx_flight_watches_user_id:
--   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.flight_watches
--   WHERE user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid());
--   → Seq Scan on flight_watches  (cost=8.29..20.11 rows=3 width=…)
--         Filter: (user_id = $1)
--
-- AFTER idx_flight_watches_user_id:
--   → Index Scan using idx_flight_watches_user_id on flight_watches
--         Index Cond: (user_id = $1)
-- ──────────────────────────────────────────────────────────────────
