-- ============================================================
-- PointsMax — Migration 006
-- India expansion: regional program metadata + seed data
-- ============================================================

-- 1) Geography support for region-aware UI filtering
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS geography TEXT NOT NULL DEFAULT 'global';

UPDATE programs
SET geography = 'global'
WHERE geography IS NULL;

CREATE INDEX IF NOT EXISTS idx_programs_geography ON programs (geography);

-- 2) India-focused loyalty programs
INSERT INTO programs (
  id,
  name,
  short_name,
  slug,
  type,
  issuer,
  color_hex,
  display_order,
  geography
)
VALUES
  ('11111111-0001-0001-0001-000000000101', 'HDFC Millennia Rewards', 'HDFC', 'hdfc-millennia', 'transferable_points', 'HDFC Bank', '#0056A4', 510, 'IN'),
  ('11111111-0001-0001-0001-000000000102', 'Axis EDGE Rewards', 'Axis EDGE', 'axis-edge', 'transferable_points', 'Axis Bank', '#8A1538', 520, 'IN'),
  ('11111111-0001-0001-0001-000000000103', 'Amex Membership Rewards India', 'Amex India MR', 'amex-india-mr', 'transferable_points', 'American Express India', '#007BC1', 530, 'IN'),
  ('22222222-0002-0002-0002-000000000101', 'Air India Maharaja Club', 'Air India', 'air-india', 'airline_miles', 'Air India', '#D2232A', 610, 'IN'),
  ('22222222-0002-0002-0002-000000000102', 'IndiGo 6E Rewards', 'IndiGo 6E', 'indigo-6e', 'airline_miles', 'IndiGo', '#1E4AA8', 620, 'IN'),
  ('33333333-0003-0003-0003-000000000101', 'Taj InnerCircle', 'Taj', 'taj-innercircle', 'hotel_points', 'IHCL', '#8B6E3B', 710, 'IN')
ON CONFLICT (slug) DO NOTHING;

-- 3) Baseline valuations for India programs
INSERT INTO valuations (program_id, cpp_cents, source, notes)
VALUES
  ('11111111-0001-0001-0001-000000000101', 1.20, 'manual', 'Regional baseline valuation for India market'),
  ('11111111-0001-0001-0001-000000000102', 1.15, 'manual', 'Regional baseline valuation for India market'),
  ('11111111-0001-0001-0001-000000000103', 1.35, 'manual', 'Regional baseline valuation for India market'),
  ('22222222-0002-0002-0002-000000000101', 1.10, 'manual', 'Regional baseline valuation for India market'),
  ('22222222-0002-0002-0002-000000000102', 0.95, 'manual', 'Regional baseline valuation for India market'),
  ('33333333-0003-0003-0003-000000000101', 0.90, 'manual', 'Regional baseline valuation for India market');

-- 4) Transfer graph for India expansion (starter set)
INSERT INTO transfer_partners (
  from_program_id,
  to_program_id,
  ratio_from,
  ratio_to,
  min_transfer,
  transfer_increment,
  transfer_time_min_hrs,
  transfer_time_max_hrs,
  is_instant,
  is_active,
  notes
)
VALUES
  ('11111111-0001-0001-0001-000000000101', '22222222-0002-0002-0002-000000000101', 1, 1, 1000, 1000, 2, 24, false, true, 'HDFC to Air India'),
  ('11111111-0001-0001-0001-000000000101', '22222222-0002-0002-0002-000000000102', 2, 1, 1000, 1000, 2, 24, false, true, 'HDFC to IndiGo'),
  ('11111111-0001-0001-0001-000000000101', '33333333-0003-0003-0003-000000000101', 2, 1, 1000, 1000, 2, 24, false, true, 'HDFC to Taj'),

  ('11111111-0001-0001-0001-000000000102', '22222222-0002-0002-0002-000000000101', 5, 4, 1000, 1000, 2, 24, false, true, 'Axis EDGE to Air India'),
  ('11111111-0001-0001-0001-000000000102', '22222222-0002-0002-0002-000000000102', 2, 1, 1000, 1000, 2, 24, false, true, 'Axis EDGE to IndiGo'),
  ('11111111-0001-0001-0001-000000000102', '33333333-0003-0003-0003-000000000101', 4, 3, 1000, 1000, 2, 24, false, true, 'Axis EDGE to Taj'),

  ('11111111-0001-0001-0001-000000000103', '22222222-0002-0002-0002-000000000101', 1, 1, 1000, 1000, 2, 24, false, true, 'Amex India to Air India'),
  ('11111111-0001-0001-0001-000000000103', '33333333-0003-0003-0003-000000000101', 1, 1, 1000, 1000, 2, 24, false, true, 'Amex India to Taj'),
  ('11111111-0001-0001-0001-000000000103', '33333333-0003-0003-0003-000000000002', 1, 1, 1000, 1000, 2, 24, false, true, 'Amex India to Marriott')
ON CONFLICT (from_program_id, to_program_id) DO NOTHING;

-- 5) Direct redemption floors for new transferable programs
INSERT INTO redemption_options (program_id, category, cpp_cents, label, notes)
VALUES
  ('11111111-0001-0001-0001-000000000101', 'travel_portal', 1.00, 'HDFC SmartBuy Travel', 'Baseline direct redemption'),
  ('11111111-0001-0001-0001-000000000101', 'cashback', 0.50, 'Statement credit', 'Low-value floor'),

  ('11111111-0001-0001-0001-000000000102', 'travel_portal', 1.00, 'Axis Travel Edge', 'Baseline direct redemption'),
  ('11111111-0001-0001-0001-000000000102', 'cashback', 0.50, 'Statement credit', 'Low-value floor'),

  ('11111111-0001-0001-0001-000000000103', 'travel_portal', 1.00, 'Amex India Travel', 'Baseline direct redemption'),
  ('11111111-0001-0001-0001-000000000103', 'cashback', 0.60, 'Statement credit', 'Low-value floor');

