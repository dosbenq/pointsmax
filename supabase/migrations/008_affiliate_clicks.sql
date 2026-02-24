-- ============================================================
-- PointsMax — Migration 008
-- Affiliate click tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID REFERENCES cards(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  source_page TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created_at ON affiliate_clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_card_source ON affiliate_clicks (card_id, source_page);
