-- ============================================================
-- PointsMax — Migration 063
-- Support syncing the points catalog from src/data/catalog/*.json
-- (npm run catalog:sync).
-- ============================================================

-- 057 inserted valuations with these sources but never added them to the
-- enum, so those inserts could not apply on a clean database.
ALTER TYPE valuation_source ADD VALUE IF NOT EXISTS 'cardexpert';
ALTER TYPE valuation_source ADD VALUE IF NOT EXISTS 'technofino';

-- The app filters on lowercase 'global'; 057 inserted 'GLOBAL'.
UPDATE programs SET geography = 'global' WHERE geography = 'GLOBAL';
