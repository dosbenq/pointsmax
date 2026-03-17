-- ============================================================
-- PointsMax — India catalog gaps
-- Targeted production gap fill based on the March 17, 2026
-- live audit. Adds missing India programs/cards and completes
-- the most important transfer edges without replaying the full
-- staging catalog.
-- ============================================================

-- 1) Missing India-side reward programs needed by premium cards
INSERT INTO programs (
  id,
  name,
  short_name,
  slug,
  type,
  issuer,
  color_hex,
  is_active,
  display_order,
  geography
)
VALUES
  ('11111111-0001-0001-0001-000000000109', 'ICICI Rewards', 'ICICI Rewards', 'icici-rewards', 'transferable_points', 'ICICI Bank', '#AE275F', true, 544, 'IN'),
  ('11111111-0001-0001-0001-000000000110', 'IndusMoments', 'IndusMoments', 'indusmoments', 'transferable_points', 'IndusInd Bank', '#7A1F1F', true, 545, 'IN'),
  ('11111111-0001-0001-0001-000000000111', 'RBL Rewards', 'RBL Rewards', 'rbl-rewards', 'transferable_points', 'RBL Bank', '#005B96', true, 546, 'IN')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  issuer = EXCLUDED.issuer,
  color_hex = EXCLUDED.color_hex,
  is_active = true,
  geography = EXCLUDED.geography,
  updated_at = now();

INSERT INTO valuations (program_id, cpp_cents, source, source_url, effective_date, notes)
VALUES
  ('11111111-0001-0001-0001-000000000109', 0.55, 'manual', 'https://www.icicibank.com/personal-banking/cards/consumer-cards/credit-card/all-cards.html', CURRENT_DATE, 'Seeded during India catalog gap fill'),
  ('11111111-0001-0001-0001-000000000110', 0.45, 'manual', 'https://www.indusind.com/in/en/personal/cards/credit-card/indulge-credit-card.html', CURRENT_DATE, 'Seeded during India catalog gap fill'),
  ('11111111-0001-0001-0001-000000000111', 0.50, 'manual', 'https://www.rblbank.com/personal-banking/cards/credit-cards/category', CURRENT_DATE, 'Seeded during India catalog gap fill')
ON CONFLICT DO NOTHING;

-- 2) Fill missing apply URLs on existing India cards where the source page is known
UPDATE cards
SET apply_url = 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/travel'
WHERE geography = 'IN'
  AND apply_url IS NULL
  AND name IN ('HDFC Infinia', 'HDFC Regalia Gold', 'HDFC Regalia First');

UPDATE cards
SET apply_url = 'https://www.axisbank.com/retail/cards/credit-card'
WHERE geography = 'IN'
  AND apply_url IS NULL
  AND name IN ('Axis Ace', 'Axis Atlas', 'Flipkart Axis Bank');

UPDATE cards
SET apply_url = 'https://www.americanexpress.com/in/credit-cards/all-cards/'
WHERE geography = 'IN'
  AND apply_url IS NULL
  AND name IN ('Amex Gold (India)', 'Amex Platinum (India)');

UPDATE cards
SET apply_url = 'https://www.sbicard.com/en/personal/credit-cards/all-cards.page'
WHERE geography = 'IN'
  AND apply_url IS NULL
  AND name IN ('Air India SBI Signature', 'SBI SimplyCLICK');

UPDATE cards
SET apply_url = 'https://www.kotak.com/en/gsfc.html'
WHERE geography = 'IN'
  AND apply_url IS NULL
  AND name = 'Kotak Royale Signature';

UPDATE cards
SET apply_url = 'https://www.yesbank.in/content/published/api/v1.1/assets/CONT07A77C257C7A4BDD85DB97E51D2B5B8F/native/yesbank_key_fact_statement.pdf?channelToken=21f7ccfa2fc3401091938f541a6f8f2a&download=false'
WHERE geography = 'IN'
  AND apply_url IS NULL
  AND name = 'Yes Bank Marquee';

-- 3) Missing premium India cards
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
  apply_url,
  is_active,
  display_order
)
SELECT *
FROM (
  VALUES
    ('aaaa0001-0000-0000-0000-000000000115', 'HDFC Diners Club Black Metal Edition', 'HDFC Bank', 10000, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000101', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/travel', true, 221),
    ('aaaa0001-0000-0000-0000-000000000116', 'Axis Bank Reserve Credit Card', 'Axis Bank', 50000, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000102', 'https://www.axisbank.com/retail/cards/credit-card', true, 231),
    ('aaaa0001-0000-0000-0000-000000000117', 'Emeralde Private Metal Credit Card', 'ICICI Bank', 12500, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000109', 'https://www.icicibank.com/personal-banking/cards/consumer-cards/credit-card/all-cards.html', true, 261),
    ('aaaa0001-0000-0000-0000-000000000118', 'Indulge Credit Card', 'IndusInd Bank', 10000, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000110', 'https://www.indusind.com/in/en/personal/cards/credit-card/indulge-credit-card.html', true, 262),
    ('aaaa0001-0000-0000-0000-000000000119', 'YES Private Credit Card', 'YES Bank', 0, 'INR', '100_inr', 'IN', 0, 0, '11111111-0001-0001-0001-000000000107', 'https://www.yesbank.in/content/published/api/v1.1/assets/CONT07A77C257C7A4BDD85DB97E51D2B5B8F/native/yesbank_key_fact_statement.pdf?channelToken=21f7ccfa2fc3401091938f541a6f8f2a&download=false', true, 263),
    ('aaaa0001-0000-0000-0000-000000000120', 'World Safari Credit Card', 'RBL Bank', 3000, 'INR', '100_inr', 'IN', 3000, 0, '11111111-0001-0001-0001-000000000111', 'https://www.rblbank.com/personal-banking/cards/credit-cards/category', true, 264),
    ('aaaa0001-0000-0000-0000-000000000121', 'SBI Card Elite', 'SBI Card', 4999, 'INR', '100_inr', 'IN', 5000, 0, '11111111-0001-0001-0001-000000000104', 'https://www.sbicard.com/en/personal/credit-cards/all-cards.page', true, 271)
) AS seed (
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
  apply_url,
  is_active,
  display_order
)
WHERE NOT EXISTS (
  SELECT 1
  FROM cards existing
  WHERE existing.name = seed.name
    AND existing.geography = 'IN'
);

INSERT INTO card_earning_rates (card_id, category, earn_multiplier)
VALUES
  ('aaaa0001-0000-0000-0000-000000000115', 'dining', 3.33),
  ('aaaa0001-0000-0000-0000-000000000115', 'groceries', 3.33),
  ('aaaa0001-0000-0000-0000-000000000115', 'travel', 3.33),
  ('aaaa0001-0000-0000-0000-000000000115', 'gas', 3.33),
  ('aaaa0001-0000-0000-0000-000000000115', 'streaming', 3.33),
  ('aaaa0001-0000-0000-0000-000000000115', 'other', 3.33),

  ('aaaa0001-0000-0000-0000-000000000116', 'dining', 2.00),
  ('aaaa0001-0000-0000-0000-000000000116', 'groceries', 2.00),
  ('aaaa0001-0000-0000-0000-000000000116', 'travel', 5.00),
  ('aaaa0001-0000-0000-0000-000000000116', 'gas', 2.00),
  ('aaaa0001-0000-0000-0000-000000000116', 'streaming', 2.00),
  ('aaaa0001-0000-0000-0000-000000000116', 'other', 2.00),

  ('aaaa0001-0000-0000-0000-000000000117', 'dining', 3.00),
  ('aaaa0001-0000-0000-0000-000000000117', 'groceries', 3.00),
  ('aaaa0001-0000-0000-0000-000000000117', 'travel', 3.00),
  ('aaaa0001-0000-0000-0000-000000000117', 'gas', 3.00),
  ('aaaa0001-0000-0000-0000-000000000117', 'streaming', 3.00),
  ('aaaa0001-0000-0000-0000-000000000117', 'other', 3.00),

  ('aaaa0001-0000-0000-0000-000000000118', 'dining', 2.00),
  ('aaaa0001-0000-0000-0000-000000000118', 'groceries', 2.00),
  ('aaaa0001-0000-0000-0000-000000000118', 'travel', 2.00),
  ('aaaa0001-0000-0000-0000-000000000118', 'gas', 2.00),
  ('aaaa0001-0000-0000-0000-000000000118', 'streaming', 2.00),
  ('aaaa0001-0000-0000-0000-000000000118', 'other', 2.00),

  ('aaaa0001-0000-0000-0000-000000000119', 'dining', 3.00),
  ('aaaa0001-0000-0000-0000-000000000119', 'groceries', 3.00),
  ('aaaa0001-0000-0000-0000-000000000119', 'travel', 3.00),
  ('aaaa0001-0000-0000-0000-000000000119', 'gas', 3.00),
  ('aaaa0001-0000-0000-0000-000000000119', 'streaming', 3.00),
  ('aaaa0001-0000-0000-0000-000000000119', 'other', 3.00),

  ('aaaa0001-0000-0000-0000-000000000120', 'dining', 2.00),
  ('aaaa0001-0000-0000-0000-000000000120', 'groceries', 2.00),
  ('aaaa0001-0000-0000-0000-000000000120', 'travel', 3.00),
  ('aaaa0001-0000-0000-0000-000000000120', 'gas', 2.00),
  ('aaaa0001-0000-0000-0000-000000000120', 'streaming', 2.00),
  ('aaaa0001-0000-0000-0000-000000000120', 'other', 2.00),

  ('aaaa0001-0000-0000-0000-000000000121', 'dining', 2.00),
  ('aaaa0001-0000-0000-0000-000000000121', 'groceries', 2.00),
  ('aaaa0001-0000-0000-0000-000000000121', 'travel', 5.00),
  ('aaaa0001-0000-0000-0000-000000000121', 'gas', 2.00),
  ('aaaa0001-0000-0000-0000-000000000121', 'streaming', 2.00),
  ('aaaa0001-0000-0000-0000-000000000121', 'other', 2.00)
ON CONFLICT (card_id, category) DO UPDATE
SET earn_multiplier = EXCLUDED.earn_multiplier;

-- 4) India transfer partner completeness and more realistic timings
UPDATE transfer_partners
SET transfer_time_max_hrs = 72,
    is_instant = false,
    updated_at = now()
WHERE from_program_id IN (
  '11111111-0001-0001-0001-000000000101',
  '11111111-0001-0001-0001-000000000102',
  '11111111-0001-0001-0001-000000000103'
)
  AND is_active = true
  AND transfer_time_max_hrs < 72;

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
SELECT *
FROM (
  VALUES
    ('11111111-0001-0001-0001-000000000101', '22222222-0002-0002-0002-000000000009', 1, 1, 1000, 1000, 48, 96, false, true, 'HDFC to Singapore KrisFlyer'),
    ('11111111-0001-0001-0001-000000000101', '22222222-0002-0002-0002-000000000006', 2, 1, 1000, 1000, 72, 120, false, true, 'HDFC to British Airways Avios'),
    ('11111111-0001-0001-0001-000000000101', '22222222-0002-0002-0002-000000000018', 2, 1, 1000, 1000, 72, 120, false, true, 'HDFC to Etihad Guest'),
    ('11111111-0001-0001-0001-000000000102', '22222222-0002-0002-0002-000000000009', 2, 1, 1000, 1000, 72, 144, false, true, 'Axis EDGE to Singapore KrisFlyer'),
    ('11111111-0001-0001-0001-000000000102', '33333333-0003-0003-0003-000000000002', 1, 4, 1000, 1000, 72, 168, false, true, 'Axis EDGE to Marriott Bonvoy'),
    ('11111111-0001-0001-0001-000000000103', '22222222-0002-0002-0002-000000000009', 2, 1, 1000, 1000, 72, 144, false, true, 'Amex India MR to Singapore KrisFlyer')
) AS seed (
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
WHERE NOT EXISTS (
  SELECT 1
  FROM transfer_partners existing
  WHERE existing.from_program_id = seed.from_program_id
    AND existing.to_program_id = seed.to_program_id
);
