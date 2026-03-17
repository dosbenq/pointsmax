CREATE TABLE IF NOT EXISTS creator_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_slug TEXT NOT NULL REFERENCES creators(slug) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  plan TEXT NOT NULL DEFAULT 'premium',
  revenue_usd INT NOT NULL DEFAULT 999
);

CREATE INDEX IF NOT EXISTS idx_creator_conversions_slug
  ON creator_conversions (creator_slug, converted_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_conversions_user
  ON creator_conversions (user_id, converted_at DESC);

ALTER TABLE creator_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own creator conversions" ON creator_conversions;
CREATE POLICY "Users read own creator conversions"
  ON creator_conversions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages creator conversions" ON creator_conversions;
CREATE POLICY "Service role manages creator conversions"
  ON creator_conversions
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');
