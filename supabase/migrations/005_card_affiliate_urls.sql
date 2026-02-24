-- ============================================================
-- PointsMax — Migration 005
-- Card affiliate/apply URLs for card recommender monetization
-- ============================================================

ALTER TABLE cards
ADD COLUMN IF NOT EXISTS apply_url TEXT;

-- Seed default issuer URLs for existing cards.
-- Replace with network-tracked affiliate URLs in production.
UPDATE cards SET apply_url = 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred'
WHERE id = 'aaaa0001-0000-0000-0000-000000000001';

UPDATE cards SET apply_url = 'https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve'
WHERE id = 'aaaa0001-0000-0000-0000-000000000002';

UPDATE cards SET apply_url = 'https://www.americanexpress.com/us/credit-cards/card/gold-card/'
WHERE id = 'aaaa0001-0000-0000-0000-000000000003';

UPDATE cards SET apply_url = 'https://www.americanexpress.com/us/credit-cards/card/platinum/'
WHERE id = 'aaaa0001-0000-0000-0000-000000000004';

UPDATE cards SET apply_url = 'https://www.capitalone.com/credit-cards/venture-x/'
WHERE id = 'aaaa0001-0000-0000-0000-000000000005';

UPDATE cards SET apply_url = 'https://www.citi.com/credit-cards/citi-strata-premier-credit-card'
WHERE id = 'aaaa0001-0000-0000-0000-000000000006';

UPDATE cards SET apply_url = 'https://www.biltrewards.com/card'
WHERE id = 'aaaa0001-0000-0000-0000-000000000007';

UPDATE cards SET apply_url = 'https://creditcards.chase.com/travel-credit-cards/united/united-explorer'
WHERE id = 'aaaa0001-0000-0000-0000-000000000008';

UPDATE cards SET apply_url = 'https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold-american-express-card/'
WHERE id = 'aaaa0001-0000-0000-0000-000000000009';

UPDATE cards SET apply_url = 'https://creditcards.chase.com/travel-credit-cards/world-of-hyatt-credit-card'
WHERE id = 'aaaa0001-0000-0000-0000-000000000010';

UPDATE cards SET apply_url = 'https://creditcards.chase.com/travel-credit-cards/marriott-bonvoy/boundless'
WHERE id = 'aaaa0001-0000-0000-0000-000000000011';
