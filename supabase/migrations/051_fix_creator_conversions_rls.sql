-- Fix creator_conversions RLS policy to use correct auth pattern
-- The existing policy compares auth.uid() directly to user_id, but these are different UUID spaces
DROP POLICY IF EXISTS "Users read own creator conversions" ON creator_conversions;

CREATE POLICY "Users read own creator conversions"
  ON creator_conversions
  FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
