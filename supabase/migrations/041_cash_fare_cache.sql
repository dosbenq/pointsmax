CREATE TABLE cash_fare_cache (
  id text PRIMARY KEY,
  origin text NOT NULL,
  destination text NOT NULL,
  cabin text NOT NULL,
  travel_date text NOT NULL,
  fare_usd int NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cash_fare_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages cash_fare_cache"
  ON cash_fare_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);
