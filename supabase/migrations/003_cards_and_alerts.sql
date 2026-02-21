-- ============================================================
-- PointsMax — Migration 003
-- Cards, card earning rates, and transfer bonus alert tracking
-- ============================================================

-- ── Transfer bonus alert tracking ────────────────────────────

ALTER TABLE transfer_bonuses ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_bonuses_alerted ON transfer_bonuses(alerted_at) WHERE alerted_at IS NULL;

-- ── Spend category enum ───────────────────────────────────────

CREATE TYPE spend_category AS ENUM (
  'dining',
  'groceries',
  'travel',
  'gas',
  'streaming',
  'other'
);

-- ── Cards table ───────────────────────────────────────────────

CREATE TABLE cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  issuer           TEXT NOT NULL,
  annual_fee_usd   INT NOT NULL DEFAULT 0,
  signup_bonus_pts INT NOT NULL DEFAULT 0,
  signup_bonus_spend INT NOT NULL DEFAULT 0,
  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  display_order    INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Card earning rates ────────────────────────────────────────

CREATE TABLE card_earning_rates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id          UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  category         spend_category NOT NULL,
  earn_multiplier  NUMERIC(4,1) NOT NULL,
  UNIQUE(card_id, category)
);

-- ── Seed: 11 cards ───────────────────────────────────────────

-- Card UUIDs (deterministic for referencing in earning rates)
INSERT INTO cards (id, name, issuer, annual_fee_usd, signup_bonus_pts, signup_bonus_spend, program_id, display_order) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'Chase Sapphire Preferred',  'Chase',           95,  60000, 4000, '11111111-0001-0001-0001-000000000001', 10),
  ('aaaa0001-0000-0000-0000-000000000002', 'Chase Sapphire Reserve',    'Chase',           550, 60000, 4000, '11111111-0001-0001-0001-000000000001', 20),
  ('aaaa0001-0000-0000-0000-000000000003', 'Amex Gold',                 'American Express',250, 60000, 4000, '11111111-0001-0001-0001-000000000002', 30),
  ('aaaa0001-0000-0000-0000-000000000004', 'Amex Platinum',             'American Express',695, 80000, 8000, '11111111-0001-0001-0001-000000000002', 40),
  ('aaaa0001-0000-0000-0000-000000000005', 'Capital One Venture X',     'Capital One',     395, 75000, 4000, '11111111-0001-0001-0001-000000000003', 50),
  ('aaaa0001-0000-0000-0000-000000000006', 'Citi Premier',              'Citi',            95,  60000, 4000, '11111111-0001-0001-0001-000000000004', 60),
  ('aaaa0001-0000-0000-0000-000000000007', 'Bilt Mastercard',           'Wells Fargo',     0,   0,     0,    '11111111-0001-0001-0001-000000000005', 70),
  ('aaaa0001-0000-0000-0000-000000000008', 'United Explorer',           'Chase',           95,  50000, 3000, '22222222-0002-0002-0002-000000000001', 80),
  ('aaaa0001-0000-0000-0000-000000000009', 'Delta Gold Amex',           'American Express',150, 40000, 2000, '22222222-0002-0002-0002-000000000002', 90),
  ('aaaa0001-0000-0000-0000-000000000010', 'World of Hyatt',            'Chase',           95,  30000, 3000, '33333333-0003-0003-0003-000000000001', 100),
  ('aaaa0001-0000-0000-0000-000000000011', 'Marriott Bonvoy Boundless', 'Chase',           95,  75000, 3000, '33333333-0003-0003-0003-000000000002', 110);

-- ── Earning rates ─────────────────────────────────────────────
-- Chase Sapphire Preferred: dining 3x, travel 2x, others 1x
INSERT INTO card_earning_rates (card_id, category, earn_multiplier) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'dining',    3.0),
  ('aaaa0001-0000-0000-0000-000000000001', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000001', 'travel',    2.0),
  ('aaaa0001-0000-0000-0000-000000000001', 'gas',       1.0),
  ('aaaa0001-0000-0000-0000-000000000001', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000001', 'other',     1.0),

-- Chase Sapphire Reserve: dining 3x, travel 3x, others 1x
  ('aaaa0001-0000-0000-0000-000000000002', 'dining',    3.0),
  ('aaaa0001-0000-0000-0000-000000000002', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000002', 'travel',    3.0),
  ('aaaa0001-0000-0000-0000-000000000002', 'gas',       1.0),
  ('aaaa0001-0000-0000-0000-000000000002', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000002', 'other',     1.0),

-- Amex Gold: dining 4x, groceries 4x, travel 3x, others 1x
  ('aaaa0001-0000-0000-0000-000000000003', 'dining',    4.0),
  ('aaaa0001-0000-0000-0000-000000000003', 'groceries', 4.0),
  ('aaaa0001-0000-0000-0000-000000000003', 'travel',    3.0),
  ('aaaa0001-0000-0000-0000-000000000003', 'gas',       1.0),
  ('aaaa0001-0000-0000-0000-000000000003', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000003', 'other',     1.0),

-- Amex Platinum: travel 5x, others 1x
  ('aaaa0001-0000-0000-0000-000000000004', 'dining',    1.0),
  ('aaaa0001-0000-0000-0000-000000000004', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000004', 'travel',    5.0),
  ('aaaa0001-0000-0000-0000-000000000004', 'gas',       1.0),
  ('aaaa0001-0000-0000-0000-000000000004', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000004', 'other',     1.0),

-- Capital One Venture X: travel 2x on everything (base), 2x all
  ('aaaa0001-0000-0000-0000-000000000005', 'dining',    2.0),
  ('aaaa0001-0000-0000-0000-000000000005', 'groceries', 2.0),
  ('aaaa0001-0000-0000-0000-000000000005', 'travel',    2.0),
  ('aaaa0001-0000-0000-0000-000000000005', 'gas',       2.0),
  ('aaaa0001-0000-0000-0000-000000000005', 'streaming', 2.0),
  ('aaaa0001-0000-0000-0000-000000000005', 'other',     2.0),

-- Citi Premier: dining 3x, groceries 3x, travel 3x, gas 3x, others 1x
  ('aaaa0001-0000-0000-0000-000000000006', 'dining',    3.0),
  ('aaaa0001-0000-0000-0000-000000000006', 'groceries', 3.0),
  ('aaaa0001-0000-0000-0000-000000000006', 'travel',    3.0),
  ('aaaa0001-0000-0000-0000-000000000006', 'gas',       3.0),
  ('aaaa0001-0000-0000-0000-000000000006', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000006', 'other',     1.0),

-- Bilt Mastercard: dining 3x, groceries 2x, travel 2x, gas 2x, others 1x
  ('aaaa0001-0000-0000-0000-000000000007', 'dining',    3.0),
  ('aaaa0001-0000-0000-0000-000000000007', 'groceries', 2.0),
  ('aaaa0001-0000-0000-0000-000000000007', 'travel',    2.0),
  ('aaaa0001-0000-0000-0000-000000000007', 'gas',       2.0),
  ('aaaa0001-0000-0000-0000-000000000007', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000007', 'other',     1.0),

-- United Explorer: dining 2x, travel 2x, others 1x
  ('aaaa0001-0000-0000-0000-000000000008', 'dining',    2.0),
  ('aaaa0001-0000-0000-0000-000000000008', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000008', 'travel',    2.0),
  ('aaaa0001-0000-0000-0000-000000000008', 'gas',       1.0),
  ('aaaa0001-0000-0000-0000-000000000008', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000008', 'other',     1.0),

-- Delta Gold Amex: dining 2x, groceries 2x, travel 2x, others 1x
  ('aaaa0001-0000-0000-0000-000000000009', 'dining',    2.0),
  ('aaaa0001-0000-0000-0000-000000000009', 'groceries', 2.0),
  ('aaaa0001-0000-0000-0000-000000000009', 'travel',    2.0),
  ('aaaa0001-0000-0000-0000-000000000009', 'gas',       1.0),
  ('aaaa0001-0000-0000-0000-000000000009', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000009', 'other',     1.0),

-- World of Hyatt: travel 4x, dining 2x, others 1x
  ('aaaa0001-0000-0000-0000-000000000010', 'dining',    2.0),
  ('aaaa0001-0000-0000-0000-000000000010', 'groceries', 1.0),
  ('aaaa0001-0000-0000-0000-000000000010', 'travel',    4.0),
  ('aaaa0001-0000-0000-0000-000000000010', 'gas',       1.0),
  ('aaaa0001-0000-0000-0000-000000000010', 'streaming', 1.0),
  ('aaaa0001-0000-0000-0000-000000000010', 'other',     1.0),

-- Marriott Bonvoy Boundless: travel 6x, dining 2x, gas 2x, groceries 2x, streaming 2x, other 2x
  ('aaaa0001-0000-0000-0000-000000000011', 'dining',    2.0),
  ('aaaa0001-0000-0000-0000-000000000011', 'groceries', 2.0),
  ('aaaa0001-0000-0000-0000-000000000011', 'travel',    6.0),
  ('aaaa0001-0000-0000-0000-000000000011', 'gas',       2.0),
  ('aaaa0001-0000-0000-0000-000000000011', 'streaming', 2.0),
  ('aaaa0001-0000-0000-0000-000000000011', 'other',     2.0);
