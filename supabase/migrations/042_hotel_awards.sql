-- ============================================================
-- PointsMax — Hotel award charts
-- Seed hotel programs and static chart data for the first
-- hotel search MVP.
-- ============================================================

CREATE TABLE IF NOT EXISTS hotel_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  chain TEXT NOT NULL,
  geography TEXT NOT NULL DEFAULT 'GLOBAL',
  color_hex TEXT,
  booking_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_award_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES hotel_programs(id) ON DELETE CASCADE,
  destination_region TEXT NOT NULL CHECK (
    destination_region IN (
      'north_america',
      'europe',
      'middle_east_africa',
      'asia_pacific',
      'latin_america',
      'india'
    )
  ),
  tier_label TEXT NOT NULL,
  tier_number INT NOT NULL,
  points_off_peak INT,
  points_standard INT NOT NULL,
  points_peak INT,
  estimated_cash_usd INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, destination_region, tier_number)
);

CREATE INDEX IF NOT EXISTS idx_hotel_programs_slug ON hotel_programs(slug);
CREATE INDEX IF NOT EXISTS idx_hotel_programs_active ON hotel_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_hotel_award_charts_program_region
  ON hotel_award_charts(program_id, destination_region, tier_number);

ALTER TABLE hotel_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_award_charts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads hotel programs" ON hotel_programs;
CREATE POLICY "Public reads hotel programs"
  ON hotel_programs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages hotel programs" ON hotel_programs;
CREATE POLICY "Service role manages hotel programs"
  ON hotel_programs
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

DROP POLICY IF EXISTS "Public reads hotel award charts" ON hotel_award_charts;
CREATE POLICY "Public reads hotel award charts"
  ON hotel_award_charts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages hotel award charts" ON hotel_award_charts;
CREATE POLICY "Service role manages hotel award charts"
  ON hotel_award_charts
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

INSERT INTO hotel_programs (slug, name, chain, geography, color_hex, booking_url)
VALUES
  ('hyatt', 'World of Hyatt', 'Hyatt', 'GLOBAL', '#B49970', 'https://world.hyatt.com/content/gp/en/rewards.html'),
  ('marriott', 'Marriott Bonvoy', 'Marriott', 'GLOBAL', '#8B1E3F', 'https://www.marriott.com/loyalty/redeem.mi'),
  ('hilton', 'Hilton Honors', 'Hilton', 'GLOBAL', '#003A70', 'https://www.hilton.com/en/hilton-honors/points/')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  chain = EXCLUDED.chain,
  geography = EXCLUDED.geography,
  color_hex = EXCLUDED.color_hex,
  booking_url = EXCLUDED.booking_url,
  is_active = true;

WITH regions(destination_region, cash_multiplier) AS (
  VALUES
    ('north_america', 1.00::numeric),
    ('europe', 1.15::numeric),
    ('middle_east_africa', 1.10::numeric),
    ('asia_pacific', 1.05::numeric),
    ('latin_america', 0.90::numeric),
    ('india', 0.82::numeric)
),
hyatt_tiers(tier_number, tier_label, points_off_peak, points_standard, points_peak, base_cash_usd) AS (
  VALUES
    (1, 'Category 1', 3500, 5000, 8000, 120),
    (2, 'Category 2', 6500, 8000, 9500, 165),
    (3, 'Category 3', 9000, 12000, 15000, 220),
    (4, 'Category 4', 12000, 15000, 18000, 320),
    (5, 'Category 5', 17000, 20000, 23000, 420),
    (6, 'Category 6', 21000, 25000, 29000, 560),
    (7, 'Category 7', 25000, 30000, 35000, 760),
    (8, 'Category 8', 35000, 40000, 45000, 980)
),
marriott_tiers(tier_number, tier_label, points_off_peak, points_standard, points_peak, base_cash_usd) AS (
  VALUES
    (1, 'Category 1', 6000, 7500, 10000, 90),
    (2, 'Category 2', 9000, 12500, 16000, 130),
    (3, 'Category 3', 15000, 17500, 21000, 175),
    (4, 'Category 4', 21000, 25000, 30000, 240),
    (5, 'Category 5', 30000, 35000, 40000, 320),
    (6, 'Category 6', 40000, 50000, 60000, 430),
    (7, 'Category 7', 60000, 70000, 85000, 650),
    (8, 'Category 8', 85000, 100000, 120000, 900)
),
hilton_tiers(tier_number, tier_label, points_off_peak, points_standard, points_peak, base_cash_usd) AS (
  VALUES
    (1, 'Tier 1', NULL, 5000, 8000, 70),
    (2, 'Tier 2', NULL, 10000, 16000, 110),
    (3, 'Tier 3', NULL, 20000, 26000, 150),
    (4, 'Tier 4', NULL, 30000, 38000, 210),
    (5, 'Tier 5', NULL, 40000, 50000, 280),
    (6, 'Tier 6', NULL, 50000, 65000, 360),
    (7, 'Tier 7', NULL, 70000, 85000, 500),
    (8, 'Tier 8', NULL, 95000, 110000, 680),
    (9, 'Tier 9', NULL, 110000, 130000, 820),
    (10, 'Tier 10', NULL, 120000, 150000, 980)
)
INSERT INTO hotel_award_charts (
  program_id,
  destination_region,
  tier_label,
  tier_number,
  points_off_peak,
  points_standard,
  points_peak,
  estimated_cash_usd
)
SELECT hp.id, r.destination_region, t.tier_label, t.tier_number, t.points_off_peak, t.points_standard, t.points_peak,
  GREATEST(60, ROUND(t.base_cash_usd * r.cash_multiplier)::int)
FROM hotel_programs hp
JOIN regions r ON true
JOIN hyatt_tiers t ON hp.slug = 'hyatt'
ON CONFLICT (program_id, destination_region, tier_number) DO UPDATE
SET
  tier_label = EXCLUDED.tier_label,
  points_off_peak = EXCLUDED.points_off_peak,
  points_standard = EXCLUDED.points_standard,
  points_peak = EXCLUDED.points_peak,
  estimated_cash_usd = EXCLUDED.estimated_cash_usd;

INSERT INTO hotel_award_charts (
  program_id,
  destination_region,
  tier_label,
  tier_number,
  points_off_peak,
  points_standard,
  points_peak,
  estimated_cash_usd
)
SELECT hp.id, r.destination_region, t.tier_label, t.tier_number, t.points_off_peak, t.points_standard, t.points_peak,
  GREATEST(60, ROUND(t.base_cash_usd * r.cash_multiplier)::int)
FROM hotel_programs hp
JOIN regions r ON true
JOIN marriott_tiers t ON hp.slug = 'marriott'
ON CONFLICT (program_id, destination_region, tier_number) DO UPDATE
SET
  tier_label = EXCLUDED.tier_label,
  points_off_peak = EXCLUDED.points_off_peak,
  points_standard = EXCLUDED.points_standard,
  points_peak = EXCLUDED.points_peak,
  estimated_cash_usd = EXCLUDED.estimated_cash_usd;

INSERT INTO hotel_award_charts (
  program_id,
  destination_region,
  tier_label,
  tier_number,
  points_off_peak,
  points_standard,
  points_peak,
  estimated_cash_usd
)
SELECT hp.id, r.destination_region, t.tier_label, t.tier_number, t.points_off_peak, t.points_standard, t.points_peak,
  GREATEST(60, ROUND(t.base_cash_usd * r.cash_multiplier)::int)
FROM hotel_programs hp
JOIN regions r ON true
JOIN hilton_tiers t ON hp.slug = 'hilton'
ON CONFLICT (program_id, destination_region, tier_number) DO UPDATE
SET
  tier_label = EXCLUDED.tier_label,
  points_off_peak = EXCLUDED.points_off_peak,
  points_standard = EXCLUDED.points_standard,
  points_peak = EXCLUDED.points_peak,
  estimated_cash_usd = EXCLUDED.estimated_cash_usd;
