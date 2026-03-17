-- ============================================================
-- PointsMax — Programmatic comparison landing pages
-- ============================================================

CREATE TABLE IF NOT EXISTS comparison_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL CHECK (region IN ('us', 'in')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  card_slugs TEXT[] NOT NULL,
  category_focus TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_comparison_pages_region
  ON comparison_pages (region, is_published, display_order);

ALTER TABLE comparison_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads comparison pages" ON comparison_pages;
CREATE POLICY "Public reads comparison pages"
  ON comparison_pages
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages comparison pages" ON comparison_pages;
CREATE POLICY "Service role manages comparison pages"
  ON comparison_pages
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

INSERT INTO comparison_pages (slug, region, title, description, card_slugs, category_focus, is_published, display_order)
VALUES
  ('best-travel-cards-us', 'us', 'Best Travel Cards in the US', 'Compare flexible travel cards for flights, partner transfers, and premium redemptions.', ARRAY['chase-sapphire-preferred', 'chase-sapphire-reserve', 'capital-one-venture-x'], 'travel', true, 10),
  ('best-dining-cards-us', 'us', 'Best Dining Cards in the US', 'Find the strongest cards for restaurants, food delivery, and everyday dining.', ARRAY['amex-gold', 'chase-sapphire-preferred', 'bilt-mastercard'], 'dining', true, 20),
  ('best-no-annual-fee-cards-us', 'us', 'Best No Annual Fee Cards in the US', 'Compare US cards that keep fees low while still earning meaningful value.', ARRAY['bilt-mastercard', 'chase-sapphire-preferred', 'united-explorer'], 'low_fees', true, 30),
  ('best-for-beginners-us', 'us', 'Best Beginner Travel Cards in the US', 'A calm starting point for users who want real value without too much complexity.', ARRAY['chase-sapphire-preferred', 'capital-one-venture-x', 'bilt-mastercard'], 'simplicity', true, 40),
  ('best-amex-cards-us', 'us', 'Best Amex Cards in the US', 'Compare the highest-signal American Express rewards cards side by side.', ARRAY['amex-gold', 'amex-platinum', 'delta-gold-amex'], 'issuer_amex', true, 50),
  ('best-chase-cards-us', 'us', 'Best Chase Cards in the US', 'Compare Chase travel and loyalty cards for transfer value and simplicity.', ARRAY['chase-sapphire-preferred', 'chase-sapphire-reserve', 'united-explorer'], 'issuer_chase', true, 60),
  ('chase-sapphire-preferred-vs-reserve', 'us', 'Chase Sapphire Preferred vs Reserve', 'A clean comparison of Chase''s two flagship Sapphire cards.', ARRAY['chase-sapphire-preferred', 'chase-sapphire-reserve'], 'issuer_chase', true, 70),
  ('amex-gold-vs-platinum', 'us', 'Amex Gold vs Platinum', 'See which Amex flagship is better for dining, travel, and premium perks.', ARRAY['amex-gold', 'amex-platinum'], 'issuer_amex', true, 80),
  ('best-for-lounge-access-us', 'us', 'Best US Cards for Lounge Access', 'Compare cards that justify themselves on lounge access and premium travel benefits.', ARRAY['amex-platinum', 'chase-sapphire-reserve', 'capital-one-venture-x'], 'lounges', true, 90),
  ('best-hotel-cards-us', 'us', 'Best US Hotel Cards', 'Compare co-branded hotel cards for premium stays and loyalty acceleration.', ARRAY['world-of-hyatt', 'marriott-bonvoy-boundless', 'amex-platinum'], 'hotels', true, 100),
  ('best-flex-points-cards-us', 'us', 'Best Flexible Points Cards in the US', 'Compare cards that earn the most useful transferable currencies.', ARRAY['chase-sapphire-preferred', 'amex-gold', 'capital-one-venture-x'], 'travel', true, 110),
  ('best-business-class-wallet-us', 'us', 'Best Wallet for Business Class Awards', 'Compare the cards most aligned with aspirational flight redemptions.', ARRAY['amex-platinum', 'chase-sapphire-reserve', 'capital-one-venture-x'], 'travel', true, 120),
  ('best-beginner-premium-cards-us', 'us', 'Best Beginner Premium Cards in the US', 'Premium-fee cards that still make sense if you actually use the benefits.', ARRAY['chase-sapphire-reserve', 'capital-one-venture-x', 'amex-platinum'], 'premium', true, 130),
  ('best-airline-cards-us', 'us', 'Best Airline Cards in the US', 'Compare a starter set of airline-linked cards against flexible alternatives.', ARRAY['united-explorer', 'delta-gold-amex', 'chase-sapphire-preferred'], 'airlines', true, 140),
  ('best-everyday-cards-us', 'us', 'Best Everyday Rewards Cards in the US', 'Compare cards that earn well across broad everyday categories.', ARRAY['amex-gold', 'bilt-mastercard', 'capital-one-venture-x'], 'everyday', true, 150),

  ('best-premium-cards-india', 'in', 'Best Premium Cards in India', 'Compare the India cards that justify a premium annual fee with travel and rewards value.', ARRAY['hdfc-infinia', 'axis-atlas', 'yes-bank-marquee'], 'premium', true, 210),
  ('best-india-travel-cards', 'in', 'Best Travel Cards in India', 'Compare Indian cards that matter for airline transfers and premium travel.', ARRAY['hdfc-infinia', 'axis-atlas', 'hdfc-diners-club-black-metal-edition'], 'travel', true, 220),
  ('best-india-low-fee-cards', 'in', 'Best Lower-Fee Cards in India', 'Compare India cards that keep fees controlled without becoming dead weight.', ARRAY['axis-ace', 'hdfc-regalia-gold', 'kotak-royale-signature'], 'low_fees', true, 230),
  ('hdfc-infinia-vs-axis-atlas', 'in', 'HDFC Infinia vs Axis Atlas', 'A direct comparison of two of the most important Indian travel cards.', ARRAY['hdfc-infinia', 'axis-atlas'], 'travel', true, 240),
  ('best-india-airline-cards', 'in', 'Best India Airline Cards', 'Compare India cards closest to airline-first redemption strategies.', ARRAY['air-india-sbi-signature', 'axis-atlas', 'sbi-card-elite'], 'airlines', true, 250),
  ('best-india-beginner-premium-cards', 'in', 'Best Beginner Premium Cards in India', 'Premium Indian cards that still make sense for users building their first optimized wallet.', ARRAY['hdfc-regalia-gold', 'axis-atlas', 'kotak-royale-signature'], 'simplicity', true, 260),
  ('best-india-lounge-cards', 'in', 'Best India Lounge Access Cards', 'Compare the India cards that are easiest to justify on premium travel benefits.', ARRAY['hdfc-infinia', 'yes-bank-marquee', 'axis-bank-reserve-credit-card'], 'lounges', true, 270),
  ('best-india-private-banking-cards', 'in', 'Best Private-Banking Style Cards in India', 'Compare the most premium India cards tied to private or invitation-style positioning.', ARRAY['emeralde-private-metal-credit-card', 'yes-private-credit-card', 'hdfc-infinia'], 'premium', true, 280)
ON CONFLICT (slug) DO UPDATE
SET
  region = EXCLUDED.region,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  card_slugs = EXCLUDED.card_slugs,
  category_focus = EXCLUDED.category_focus,
  is_published = EXCLUDED.is_published,
  display_order = EXCLUDED.display_order;
