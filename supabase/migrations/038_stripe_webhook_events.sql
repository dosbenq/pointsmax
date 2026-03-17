CREATE TABLE stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb NOT NULL
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages stripe_webhook_events"
  ON stripe_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);
