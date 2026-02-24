-- ============================================================
-- PointsMax — Migration 007
-- India card catalog + region-aware earning unit support
-- ============================================================

-- 1) Region/currency metadata for cards
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS earn_unit TEXT NOT NULL DEFAULT '1_dollar';

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS geography TEXT NOT NULL DEFAULT 'US';

-- Existing data defaults
UPDATE cards
SET currency = 'USD',
    earn_unit = '1_dollar',
    geography = 'US'
WHERE currency IS NULL OR earn_unit IS NULL OR geography IS NULL;

CREATE INDEX IF NOT EXISTS idx_cards_geography_active ON cards (geography, is_active);

-- Need 2-decimal precision for rates like 3.33 points / ₹100
ALTER TABLE card_earning_rates
  ALTER COLUMN earn_multiplier TYPE NUMERIC(6,2);

-- 2) India cards
-- Source references for earn rates/fees:
-- HDFC Infinia & Regalia Gold rewards pages (hdfcbank.com)
-- Axis Atlas & Axis Ace card pages / FAQs (axisbank.com)
-- Amex India Membership Rewards FAQs (americanexpress.com/en-in)
-- Air India SBI Signature card page (sbi.co.in)
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
  ('aaaa0001-0000-0000-0000-000000000101', 'HDFC Infinia', 'HDFC Bank', 12500, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000101', true, 210),
  ('aaaa0001-0000-0000-0000-000000000102', 'HDFC Regalia Gold', 'HDFC Bank', 2500, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000101', true, 220),
  ('aaaa0001-0000-0000-0000-000000000103', 'Axis Atlas', 'Axis Bank', 5000, 'INR', '100_inr', 'IN', 2500, 0, '11111111-0001-0001-0001-000000000102', true, 230),
  ('aaaa0001-0000-0000-0000-000000000104', 'Axis Ace', 'Axis Bank', 499, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000102', true, 240),
  ('aaaa0001-0000-0000-0000-000000000105', 'Amex Platinum (India)', 'American Express India', 60000, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000103', true, 250),
  ('aaaa0001-0000-0000-0000-000000000106', 'Amex Gold (India)', 'American Express India', 4500, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000103', true, 260),
  ('aaaa0001-0000-0000-0000-000000000107', 'Air India SBI Signature', 'SBI Card', 4999, 'INR', '100_inr', 'IN', 20000, 0, '22222222-0002-0002-0002-000000000101', true, 270)
ON CONFLICT (id) DO NOTHING;

-- 3) India earning rates (points per ₹100)
INSERT INTO card_earning_rates (card_id, category, earn_multiplier)
VALUES
  -- HDFC Infinia: 5 points / ₹150 => 3.33 / ₹100
  ('aaaa0001-0000-0000-0000-000000000101', 'dining', 3.33),
  ('aaaa0001-0000-0000-0000-000000000101', 'groceries', 3.33),
  ('aaaa0001-0000-0000-0000-000000000101', 'travel', 3.33),
  ('aaaa0001-0000-0000-0000-000000000101', 'gas', 3.33),
  ('aaaa0001-0000-0000-0000-000000000101', 'streaming', 3.33),
  ('aaaa0001-0000-0000-0000-000000000101', 'other', 3.33),

  -- HDFC Regalia Gold: 4 points / ₹150 => 2.67 / ₹100
  ('aaaa0001-0000-0000-0000-000000000102', 'dining', 2.67),
  ('aaaa0001-0000-0000-0000-000000000102', 'groceries', 2.67),
  ('aaaa0001-0000-0000-0000-000000000102', 'travel', 2.67),
  ('aaaa0001-0000-0000-0000-000000000102', 'gas', 2.67),
  ('aaaa0001-0000-0000-0000-000000000102', 'streaming', 2.67),
  ('aaaa0001-0000-0000-0000-000000000102', 'other', 2.67),

  -- Axis Atlas: 5 Edge Miles on travel, 2 on other categories (per ₹100)
  ('aaaa0001-0000-0000-0000-000000000103', 'dining', 2.00),
  ('aaaa0001-0000-0000-0000-000000000103', 'groceries', 2.00),
  ('aaaa0001-0000-0000-0000-000000000103', 'travel', 5.00),
  ('aaaa0001-0000-0000-0000-000000000103', 'gas', 2.00),
  ('aaaa0001-0000-0000-0000-000000000103', 'streaming', 2.00),
  ('aaaa0001-0000-0000-0000-000000000103', 'other', 2.00),

  -- Axis Ace: 2 reward-equivalent units per ₹100 baseline
  ('aaaa0001-0000-0000-0000-000000000104', 'dining', 2.00),
  ('aaaa0001-0000-0000-0000-000000000104', 'groceries', 2.00),
  ('aaaa0001-0000-0000-0000-000000000104', 'travel', 2.00),
  ('aaaa0001-0000-0000-0000-000000000104', 'gas', 2.00),
  ('aaaa0001-0000-0000-0000-000000000104', 'streaming', 2.00),
  ('aaaa0001-0000-0000-0000-000000000104', 'other', 2.00),

  -- Amex Platinum India: 1 MR point / ₹40 => 2.5 / ₹100
  ('aaaa0001-0000-0000-0000-000000000105', 'dining', 2.50),
  ('aaaa0001-0000-0000-0000-000000000105', 'groceries', 2.50),
  ('aaaa0001-0000-0000-0000-000000000105', 'travel', 2.50),
  ('aaaa0001-0000-0000-0000-000000000105', 'gas', 2.50),
  ('aaaa0001-0000-0000-0000-000000000105', 'streaming', 2.50),
  ('aaaa0001-0000-0000-0000-000000000105', 'other', 2.50),

  -- Amex Gold India: 1 MR point / ₹50 => 2 / ₹100
  ('aaaa0001-0000-0000-0000-000000000106', 'dining', 2.00),
  ('aaaa0001-0000-0000-0000-000000000106', 'groceries', 2.00),
  ('aaaa0001-0000-0000-0000-000000000106', 'travel', 2.00),
  ('aaaa0001-0000-0000-0000-000000000106', 'gas', 2.00),
  ('aaaa0001-0000-0000-0000-000000000106', 'streaming', 2.00),
  ('aaaa0001-0000-0000-0000-000000000106', 'other', 2.00),

  -- Air India SBI Signature: 10 points / ₹100 on Air India, 4 / ₹100 elsewhere
  ('aaaa0001-0000-0000-0000-000000000107', 'dining', 4.00),
  ('aaaa0001-0000-0000-0000-000000000107', 'groceries', 4.00),
  ('aaaa0001-0000-0000-0000-000000000107', 'travel', 10.00),
  ('aaaa0001-0000-0000-0000-000000000107', 'gas', 4.00),
  ('aaaa0001-0000-0000-0000-000000000107', 'streaming', 4.00),
  ('aaaa0001-0000-0000-0000-000000000107', 'other', 4.00)
ON CONFLICT (card_id, category) DO UPDATE SET
  earn_multiplier = EXCLUDED.earn_multiplier;
