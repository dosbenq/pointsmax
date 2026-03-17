CREATE TABLE subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  stripe_customer_id text,
  event_type text NOT NULL,
  previous_tier text,
  new_tier text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX idx_subscription_events_user_id
  ON subscription_events(user_id);

CREATE INDEX idx_subscription_events_customer
  ON subscription_events(stripe_customer_id);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription_events"
  ON subscription_events FOR SELECT TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service role manages subscription_events"
  ON subscription_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);
