-- Deal Scout re-sent the same deal every hour; remember the last deal emailed per watch.
ALTER TABLE flight_watches ADD COLUMN IF NOT EXISTS last_alert_key text;
ALTER TABLE flight_watches ADD COLUMN IF NOT EXISTS last_alerted_at timestamptz;
