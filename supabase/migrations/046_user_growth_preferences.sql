ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS digest_email_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE users
SET last_seen_at = created_at
WHERE last_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at
  ON users (last_seen_at DESC);
