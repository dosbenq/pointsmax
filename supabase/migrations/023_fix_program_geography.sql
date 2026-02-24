-- ============================================================
-- PointsMax — Migration 023
-- Fix program geography tags - separate US and India programs
-- ============================================================

-- 1) Tag US programs correctly (programs that should only show for US region)
-- These are US bank transfer programs and US-specific airline/hotel programs
UPDATE programs
SET geography = 'US'
WHERE slug IN (
  -- US Transferable Points
  'chase-ur',
  'amex-mr',
  'capital-one',
  'citi-thankyou',
  'bilt',
  'wells-fargo-rewards',
  'us-bank-altitude',
  'discover-miles',
  -- US Airlines
  'united',
  'delta',
  'american',
  'southwest',
  'alaska',
  'jetblue',
  -- US Hotels
  'hyatt',
  'marriott',
  'hilton',
  'ihg',
  'wyndham'
);

-- 2) Tag India programs correctly (ensure they're marked as IN)
UPDATE programs
SET geography = 'IN'
WHERE slug IN (
  -- India Transferable Points
  'hdfc-millennia',
  'axis-edge',
  'amex-india-mr',
  'sbi-reward-points',
  'amazon-pay-rewards',
  'kotak-royale',
  'yes-rewardz',
  'standard-chartered-360',
  -- India Airlines
  'air-india',
  'indigo-6e',
  -- India Hotels
  'taj-innercircle'
);

-- 3) Keep truly global programs as 'global'
-- These should be available in both regions (international airlines/hotels)
-- No update needed for these as they should already be 'global' or will stay 'global'
-- Examples: international airlines like Emirates, hotels like Marriott (international)

-- Verify counts
-- SELECT geography, COUNT(*) FROM programs GROUP BY geography;
