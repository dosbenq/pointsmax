-- Enable RLS on tables that are currently exposed
ALTER TABLE shared_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;

-- shared_trips: public read (shared links), authenticated write for own trips
CREATE POLICY "Anyone can read shared trips" ON shared_trips FOR SELECT USING (true);
CREATE POLICY "Users can insert own shared trips" ON shared_trips FOR INSERT WITH CHECK (
  created_by IS NULL OR created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- onboarding_email_log: service role only (contains PII)
CREATE POLICY "Service role only for onboarding email log" ON onboarding_email_log
  FOR ALL USING (auth.role() = 'service_role');

-- link_health_log: service role only
CREATE POLICY "Service role only for link health log" ON link_health_log
  FOR ALL USING (auth.role() = 'service_role');

-- creators: public read, service role write
CREATE POLICY "Anyone can read creators" ON creators FOR SELECT USING (true);
CREATE POLICY "Service role manages creators" ON creators
  FOR ALL USING (auth.role() = 'service_role');

-- Enable RLS on staging tables
ALTER TABLE catalog_programs_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_cards_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for catalog staging" ON catalog_programs_staging
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only for cards staging" ON catalog_cards_staging
  FOR ALL USING (auth.role() = 'service_role');
