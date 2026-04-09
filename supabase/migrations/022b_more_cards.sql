-- ============================================================
-- PointsMax — Migration 022
-- Expanded US + India card catalog and loyalty programs
-- ============================================================

-- Ensure regional card metadata columns exist (backward-compatible runs)
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS earn_unit TEXT NOT NULL DEFAULT '1_dollar';

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS geography TEXT NOT NULL DEFAULT 'US';

-- Add supporting loyalty programs used by new cards
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
  -- US programs
  ('11111111-0001-0001-0001-000000000006', 'Wells Fargo Rewards', 'Wells Fargo', 'wells-fargo-rewards', 'transferable_points', 'Wells Fargo', '#B31B1B', 125, 'US'),
  ('11111111-0001-0001-0001-000000000007', 'US Bank Altitude Rewards', 'US Bank Altitude', 'us-bank-altitude', 'transferable_points', 'US Bank', '#0050A0', 126, 'US'),
  ('11111111-0001-0001-0001-000000000008', 'Discover Miles', 'Discover Miles', 'discover-miles', 'transferable_points', 'Discover', '#FF6600', 127, 'US'),
  -- India programs
  ('11111111-0001-0001-0001-000000000104', 'SBI Reward Points', 'SBI Rewards', 'sbi-reward-points', 'transferable_points', 'SBI Card', '#1A4A8A', 540, 'IN'),
  ('11111111-0001-0001-0001-000000000105', 'Amazon Pay Rewards', 'Amazon Pay', 'amazon-pay-rewards', 'cashback', 'ICICI Bank', '#FF9900', 541, 'IN'),
  ('11111111-0001-0001-0001-000000000106', 'Kotak Royale Rewards', 'Kotak Royale', 'kotak-royale', 'transferable_points', 'Kotak Mahindra Bank', '#003B6F', 542, 'IN'),
  ('11111111-0001-0001-0001-000000000107', 'YES Rewardz', 'YES Rewardz', 'yes-rewardz', 'transferable_points', 'YES Bank', '#1A4F9A', 543, 'IN'),
  ('11111111-0001-0001-0001-000000000108', 'Standard Chartered 360 Rewards', 'SC 360', 'standard-chartered-360', 'transferable_points', 'Standard Chartered', '#0072CE', 544, 'IN')
ON CONFLICT (id) DO NOTHING;

-- Baseline valuations for new programs
INSERT INTO valuations (program_id, cpp_cents, source, notes, effective_date)
SELECT
  x.program_id,
  x.cpp_cents,
  'manual',
  x.notes,
  CURRENT_DATE
FROM (
  VALUES
    ('11111111-0001-0001-0001-000000000006'::uuid, 1.35::numeric, 'Baseline US valuation'),
    ('11111111-0001-0001-0001-000000000007'::uuid, 1.50::numeric, 'Baseline US valuation'),
    ('11111111-0001-0001-0001-000000000008'::uuid, 1.00::numeric, 'Baseline US valuation'),
    ('11111111-0001-0001-0001-000000000104'::uuid, 25::numeric, 'Baseline India valuation in paise'),
    ('11111111-0001-0001-0001-000000000105'::uuid, 100::numeric, 'Baseline India valuation in paise'),
    ('11111111-0001-0001-0001-000000000106'::uuid, 35::numeric, 'Baseline India valuation in paise'),
    ('11111111-0001-0001-0001-000000000107'::uuid, 55::numeric, 'Baseline India valuation in paise'),
    ('11111111-0001-0001-0001-000000000108'::uuid, 45::numeric, 'Baseline India valuation in paise')
) AS x(program_id, cpp_cents, notes)
WHERE NOT EXISTS (
  SELECT 1
  FROM valuations v
  WHERE v.program_id = x.program_id
    AND v.source = 'manual'
    AND v.effective_date = CURRENT_DATE
);

-- Add US cards (bring catalog depth to 20+)
INSERT INTO cards (
  id,
  name,
  issuer,
  annual_fee_usd,
  currency,
  earn_unit,
  geography,
  signup_bonus_pts,
  signup_bonus_spend,
  program_id,
  is_active,
  display_order
)
VALUES
  ('aaaa0001-0000-0000-0000-000000000201', 'Chase Freedom Unlimited', 'Chase', 0, 'USD', '1_dollar', 'US', 20000, 500, '11111111-0001-0001-0001-000000000001', true, 120),
  ('aaaa0001-0000-0000-0000-000000000202', 'Chase Freedom Flex', 'Chase', 0, 'USD', '1_dollar', 'US', 20000, 500, '11111111-0001-0001-0001-000000000001', true, 121),
  ('aaaa0001-0000-0000-0000-000000000203', 'Wells Fargo Autograph', 'Wells Fargo', 0, 'USD', '1_dollar', 'US', 30000, 1500, '11111111-0001-0001-0001-000000000006', true, 122),
  ('aaaa0001-0000-0000-0000-000000000204', 'US Bank Altitude Reserve', 'US Bank', 400, 'USD', '1_dollar', 'US', 50000, 4500, '11111111-0001-0001-0001-000000000007', true, 123),
  ('aaaa0001-0000-0000-0000-000000000205', 'Discover it Miles', 'Discover', 0, 'USD', '1_dollar', 'US', 0, 0, '11111111-0001-0001-0001-000000000008', true, 124),
  ('aaaa0001-0000-0000-0000-000000000206', 'Capital One SavorOne', 'Capital One', 0, 'USD', '1_dollar', 'US', 20000, 500, '11111111-0001-0001-0001-000000000003', true, 125),
  ('aaaa0001-0000-0000-0000-000000000207', 'Amex Green', 'American Express', 150, 'USD', '1_dollar', 'US', 40000, 3000, '11111111-0001-0001-0001-000000000002', true, 126),
  ('aaaa0001-0000-0000-0000-000000000208', 'Citi Double Cash', 'Citi', 0, 'USD', '1_dollar', 'US', 20000, 1500, '11111111-0001-0001-0001-000000000004', true, 127),
  ('aaaa0001-0000-0000-0000-000000000209', 'Hilton Honors Surpass', 'American Express', 150, 'USD', '1_dollar', 'US', 130000, 3000, '33333333-0003-0003-0003-000000000003', true, 128)
ON CONFLICT (id) DO NOTHING;

-- Add India cards (bring catalog depth to 14+)
INSERT INTO cards (
  id,
  name,
  issuer,
  annual_fee_usd,
  currency,
  earn_unit,
  geography,
  signup_bonus_pts,
  signup_bonus_spend,
  program_id,
  is_active,
  display_order
)
VALUES
  ('aaaa0001-0000-0000-0000-000000000301', 'SBI SimplyCLICK', 'SBI Card', 499, 'INR', '100_inr', 'IN', 500, 0, '11111111-0001-0001-0001-000000000104', true, 280),
  ('aaaa0001-0000-0000-0000-000000000302', 'ICICI Amazon Pay', 'ICICI Bank', 0, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000105', true, 281),
  ('aaaa0001-0000-0000-0000-000000000303', 'Kotak Royale Signature', 'Kotak Mahindra Bank', 1499, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000106', true, 282),
  ('aaaa0001-0000-0000-0000-000000000304', 'Yes Bank Marquee', 'YES Bank', 9999, 'INR', '100_inr', 'IN', 60000, 0, '11111111-0001-0001-0001-000000000107', true, 283),
  ('aaaa0001-0000-0000-0000-000000000305', 'Flipkart Axis Bank', 'Axis Bank', 500, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000102', true, 284),
  ('aaaa0001-0000-0000-0000-000000000306', 'HDFC Regalia First', 'HDFC Bank', 1000, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000101', true, 285),
  ('aaaa0001-0000-0000-0000-000000000307', 'Standard Chartered EaseMyTrip', 'Standard Chartered', 350, 'INR', '100_inr', 'IN', 5000, 0, '11111111-0001-0001-0001-000000000108', true, 286)
ON CONFLICT (id) DO NOTHING;

-- Earning rates for newly added cards
INSERT INTO card_earning_rates (card_id, category, earn_multiplier)
VALUES
  -- Chase Freedom Unlimited
  ('aaaa0001-0000-0000-0000-000000000201', 'dining', 3.0),
  ('aaaa0001-0000-0000-0000-000000000201', 'groceries', 1.5),
  ('aaaa0001-0000-0000-0000-000000000201', 'travel', 5.0),
  ('aaaa0001-0000-0000-0000-000000000201', 'gas', 1.5),
  ('aaaa0001-0000-0000-0000-000000000201', 'streaming', 1.5),
  ('aaaa0001-0000-0000-0000-000000000201', 'other', 1.5),

  -- Chase Freedom Flex
  ('aaaa0001-0000-0000-0000-000000000202', 'dining', 3.0),
  ('aaaa0001-0000-0000-0000-000000000202', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000202', 'travel', 5.0),
  ('aaaa0001-0000-0000-0000-000000000202', 'gas', 1.0),
  ('aaaa0001-0000-0000-0000-000000000202', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000202', 'other', 1.0),

  -- Wells Fargo Autograph
  ('aaaa0001-0000-0000-0000-000000000203', 'dining', 3.0),
  ('aaaa0001-0000-0000-0000-000000000203', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000203', 'travel', 3.0),
  ('aaaa0001-0000-0000-0000-000000000203', 'gas', 3.0),
  ('aaaa0001-0000-0000-0000-000000000203', 'streaming', 3.0),
  ('aaaa0001-0000-0000-0000-000000000203', 'other', 1.0),

  -- US Bank Altitude Reserve
  ('aaaa0001-0000-0000-0000-000000000204', 'dining', 1.0),
  ('aaaa0001-0000-0000-0000-000000000204', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000204', 'travel', 3.0),
  ('aaaa0001-0000-0000-0000-000000000204', 'gas', 1.0),
  ('aaaa0001-0000-0000-0000-000000000204', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000204', 'other', 1.0),

  -- Discover it Miles
  ('aaaa0001-0000-0000-0000-000000000205', 'dining', 1.5),
  ('aaaa0001-0000-0000-0000-000000000205', 'groceries', 1.5),
  ('aaaa0001-0000-0000-0000-000000000205', 'travel', 1.5),
  ('aaaa0001-0000-0000-0000-000000000205', 'gas', 1.5),
  ('aaaa0001-0000-0000-0000-000000000205', 'streaming', 1.5),
  ('aaaa0001-0000-0000-0000-000000000205', 'other', 1.5),

  -- Capital One SavorOne
  ('aaaa0001-0000-0000-0000-000000000206', 'dining', 3.0),
  ('aaaa0001-0000-0000-0000-000000000206', 'groceries', 3.0),
  ('aaaa0001-0000-0000-0000-000000000206', 'travel', 3.0),
  ('aaaa0001-0000-0000-0000-000000000206', 'gas', 1.0),
  ('aaaa0001-0000-0000-0000-000000000206', 'streaming', 3.0),
  ('aaaa0001-0000-0000-0000-000000000206', 'other', 1.0),

  -- Amex Green
  ('aaaa0001-0000-0000-0000-000000000207', 'dining', 3.0),
  ('aaaa0001-0000-0000-0000-000000000207', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000207', 'travel', 3.0),
  ('aaaa0001-0000-0000-0000-000000000207', 'gas', 1.0),
  ('aaaa0001-0000-0000-0000-000000000207', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000207', 'other', 1.0),

  -- Citi Double Cash
  ('aaaa0001-0000-0000-0000-000000000208', 'dining', 2.0),
  ('aaaa0001-0000-0000-0000-000000000208', 'groceries', 2.0),
  ('aaaa0001-0000-0000-0000-000000000208', 'travel', 2.0),
  ('aaaa0001-0000-0000-0000-000000000208', 'gas', 2.0),
  ('aaaa0001-0000-0000-0000-000000000208', 'streaming', 2.0),
  ('aaaa0001-0000-0000-0000-000000000208', 'other', 2.0),

  -- Hilton Honors Surpass
  ('aaaa0001-0000-0000-0000-000000000209', 'dining', 3.0),
  ('aaaa0001-0000-0000-0000-000000000209', 'groceries', 3.0),
  ('aaaa0001-0000-0000-0000-000000000209', 'travel', 6.0),
  ('aaaa0001-0000-0000-0000-000000000209', 'gas', 3.0),
  ('aaaa0001-0000-0000-0000-000000000209', 'streaming', 3.0),
  ('aaaa0001-0000-0000-0000-000000000209', 'other', 3.0),

  -- SBI SimplyCLICK
  ('aaaa0001-0000-0000-0000-000000000301', 'dining', 2.0),
  ('aaaa0001-0000-0000-0000-000000000301', 'groceries', 2.0),
  ('aaaa0001-0000-0000-0000-000000000301', 'travel', 5.0),
  ('aaaa0001-0000-0000-0000-000000000301', 'gas', 1.0),
  ('aaaa0001-0000-0000-0000-000000000301', 'streaming', 5.0),
  ('aaaa0001-0000-0000-0000-000000000301', 'other', 5.0),

  -- ICICI Amazon Pay
  ('aaaa0001-0000-0000-0000-000000000302', 'dining', 2.0),
  ('aaaa0001-0000-0000-0000-000000000302', 'groceries', 3.0),
  ('aaaa0001-0000-0000-0000-000000000302', 'travel', 1.0),
  ('aaaa0001-0000-0000-0000-000000000302', 'gas', 1.0),
  ('aaaa0001-0000-0000-0000-000000000302', 'streaming', 2.0),
  ('aaaa0001-0000-0000-0000-000000000302', 'other', 5.0),

  -- Kotak Royale Signature
  ('aaaa0001-0000-0000-0000-000000000303', 'dining', 4.0),
  ('aaaa0001-0000-0000-0000-000000000303', 'groceries', 4.0),
  ('aaaa0001-0000-0000-0000-000000000303', 'travel', 4.0),
  ('aaaa0001-0000-0000-0000-000000000303', 'gas', 4.0),
  ('aaaa0001-0000-0000-0000-000000000303', 'streaming', 4.0),
  ('aaaa0001-0000-0000-0000-000000000303', 'other', 4.0),

  -- Yes Bank Marquee
  ('aaaa0001-0000-0000-0000-000000000304', 'dining', 12.0),
  ('aaaa0001-0000-0000-0000-000000000304', 'groceries', 8.0),
  ('aaaa0001-0000-0000-0000-000000000304', 'travel', 12.0),
  ('aaaa0001-0000-0000-0000-000000000304', 'gas', 8.0),
  ('aaaa0001-0000-0000-0000-000000000304', 'streaming', 8.0),
  ('aaaa0001-0000-0000-0000-000000000304', 'other', 8.0),

  -- Flipkart Axis Bank
  ('aaaa0001-0000-0000-0000-000000000305', 'dining', 2.0),
  ('aaaa0001-0000-0000-0000-000000000305', 'groceries', 2.0),
  ('aaaa0001-0000-0000-0000-000000000305', 'travel', 2.0),
  ('aaaa0001-0000-0000-0000-000000000305', 'gas', 1.0),
  ('aaaa0001-0000-0000-0000-000000000305', 'streaming', 4.0),
  ('aaaa0001-0000-0000-0000-000000000305', 'other', 5.0),

  -- HDFC Regalia First
  ('aaaa0001-0000-0000-0000-000000000306', 'dining', 2.67),
  ('aaaa0001-0000-0000-0000-000000000306', 'groceries', 2.67),
  ('aaaa0001-0000-0000-0000-000000000306', 'travel', 2.67),
  ('aaaa0001-0000-0000-0000-000000000306', 'gas', 2.67),
  ('aaaa0001-0000-0000-0000-000000000306', 'streaming', 2.67),
  ('aaaa0001-0000-0000-0000-000000000306', 'other', 2.67),

  -- Standard Chartered EaseMyTrip
  ('aaaa0001-0000-0000-0000-000000000307', 'dining', 2.0),
  ('aaaa0001-0000-0000-0000-000000000307', 'groceries', 2.0),
  ('aaaa0001-0000-0000-0000-000000000307', 'travel', 5.0),
  ('aaaa0001-0000-0000-0000-000000000307', 'gas', 2.0),
  ('aaaa0001-0000-0000-0000-000000000307', 'streaming', 2.0),
  ('aaaa0001-0000-0000-0000-000000000307', 'other', 2.0)
ON CONFLICT (card_id, category) DO UPDATE
SET earn_multiplier = EXCLUDED.earn_multiplier;
