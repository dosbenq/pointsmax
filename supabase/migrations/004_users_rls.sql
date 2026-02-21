-- Migration 004: Protect users table with RLS

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile row" ON public.users;
DROP POLICY IF EXISTS "Users see own profile" ON public.users;
CREATE POLICY "Users see own profile"
  ON public.users
  FOR SELECT
  USING (auth_id = auth.uid());
