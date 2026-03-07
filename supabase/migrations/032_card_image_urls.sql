-- ============================================================
-- PointsMax — Migration 032
-- Card image URLs backed by local repo-hosted assets
-- ============================================================

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE cards SET image_url = '/card-art/chase-sapphire-preferred.svg'
WHERE name = 'Chase Sapphire Preferred';
UPDATE cards SET image_url = '/card-art/chase-sapphire-reserve.svg'
WHERE name = 'Chase Sapphire Reserve';
UPDATE cards SET image_url = '/card-art/amex-gold.svg'
WHERE name = 'Amex Gold';
UPDATE cards SET image_url = '/card-art/amex-platinum.svg'
WHERE name = 'Amex Platinum';
UPDATE cards SET image_url = '/card-art/capital-one-venture-x.svg'
WHERE name = 'Capital One Venture X';
UPDATE cards SET image_url = '/card-art/citi-premier.svg'
WHERE name = 'Citi Premier';
UPDATE cards SET image_url = '/card-art/bilt-mastercard.svg'
WHERE name = 'Bilt Mastercard';
UPDATE cards SET image_url = '/card-art/united-explorer.svg'
WHERE name = 'United Explorer';
UPDATE cards SET image_url = '/card-art/delta-gold-amex.svg'
WHERE name = 'Delta Gold Amex';
UPDATE cards SET image_url = '/card-art/world-of-hyatt.svg'
WHERE name = 'World of Hyatt';
UPDATE cards SET image_url = '/card-art/marriott-bonvoy-boundless.svg'
WHERE name = 'Marriott Bonvoy Boundless';
UPDATE cards SET image_url = '/card-art/hdfc-infinia.svg'
WHERE name = 'HDFC Infinia';
UPDATE cards SET image_url = '/card-art/hdfc-regalia-gold.svg'
WHERE name = 'HDFC Regalia Gold';
UPDATE cards SET image_url = '/card-art/axis-atlas.svg'
WHERE name = 'Axis Atlas';
UPDATE cards SET image_url = '/card-art/axis-ace.svg'
WHERE name = 'Axis Ace';
UPDATE cards SET image_url = '/card-art/amex-platinum-india.svg'
WHERE name = 'Amex Platinum (India)';
UPDATE cards SET image_url = '/card-art/amex-gold-india.svg'
WHERE name = 'Amex Gold (India)';
UPDATE cards SET image_url = '/card-art/air-india-sbi-signature.svg'
WHERE name = 'Air India SBI Signature';
