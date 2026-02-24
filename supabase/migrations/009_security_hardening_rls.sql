-- ============================================================
-- PointsMax — Migration 009
-- Security hardening: enforce RLS on user-linked tables
-- ============================================================

-- user_balances: re-assert RLS + explicit USING/WITH CHECK policy
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own balances" ON public.user_balances;
DROP POLICY IF EXISTS "Users manage own balances" ON public.user_balances;
CREATE POLICY "Users manage own balances"
  ON public.user_balances
  FOR ALL
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- alert_subscriptions: protect subscriber emails and watchlists
ALTER TABLE public.alert_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own alert subscriptions" ON public.alert_subscriptions;
CREATE POLICY "Users manage own alert subscriptions"
  ON public.alert_subscriptions
  FOR ALL
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- affiliate_clicks: lock down click telemetry from client reads/writes
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
