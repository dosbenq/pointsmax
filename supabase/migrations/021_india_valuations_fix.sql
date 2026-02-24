-- ============================================================-- PointsMax — Migration 021-- Fix: Correct Indian program valuations (paise per point)-- ============================================================
-- Note: Values are stored in PAUSE (1 INR = 100 paise)
-- Correct seed values based on market research:
-- - HDFC Millennia: ₹0.50/pt blended (conservative average)
-- - Axis EDGE: ₹0.50/pt (similar to HDFC structure)
-- - Amex India MR: ₹0.75/pt (better airline partners)
-- - Air India: ₹1.00/mile (business class awards average)
-- - IndiGo 6E: ₹0.30/pt (limited redemption options)
-- - Taj InnerCircle: ₹0.80/pt (hotel redemptions average)

-- Drop the view that depends on cpp_cents so we can alter the column type
DROP VIEW IF EXISTS latest_valuations;

-- Alter the column type for greater precision
ALTER TABLE public.valuations ALTER COLUMN cpp_cents TYPE NUMERIC(10,4);

-- Recreate the view identically
CREATE VIEW latest_valuations AS
  SELECT DISTINCT ON (program_id)
    v.*,
    p.name        AS program_name,
    p.slug        AS program_slug,
    p.type        AS program_type
  FROM valuations v
  JOIN programs p ON p.id = v.program_id
  WHERE p.is_active = true
  ORDER BY program_id, effective_date DESC, created_at DESC;

-- Update India programs with correct valuations (in paise)
UPDATE public.valuations
SET cpp_cents = CASE
  WHEN program_id = '11111111-0001-0001-0001-000000000101' THEN 50   -- HDFC Millennia: ₹0.50
  WHEN program_id = '11111111-0001-0001-0001-000000000102' THEN 50   -- Axis EDGE: ₹0.50
  WHEN program_id = '11111111-0001-0001-0001-000000000103' THEN 75   -- Amex India MR: ₹0.75
  WHEN program_id = '22222222-0002-0002-0002-000000000101' THEN 100  -- Air India: ₹1.00
  WHEN program_id = '22222222-0002-0002-0002-000000000102' THEN 30   -- IndiGo 6E: ₹0.30
  WHEN program_id = '33333333-0003-0003-0003-000000000101' THEN 80   -- Taj InnerCircle: ₹0.80
END,
source = 'manual',
notes = 'Corrected baseline valuation for India market (paise per point)',
effective_date = CURRENT_DATE
WHERE program_id IN (
  '11111111-0001-0001-0001-000000000101', -- HDFC
  '11111111-0001-0001-0001-000000000102', -- Axis
  '11111111-0001-0001-0001-000000000103', -- Amex India
  '22222222-0002-0002-0002-000000000101', -- Air India
  '22222222-0002-0002-0002-000000000102', -- IndiGo
  '33333333-0003-0003-0003-000000000101'  -- Taj
);

-- Ensure unique constraint exists for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_valuations_program_date_source 
ON valuations (program_id, effective_date, source);

-- Insert new valuations if they don't exist (fallback)
INSERT INTO valuations (program_id, cpp_cents, source, notes, effective_date)
SELECT 
  id,
  CASE slug
    WHEN 'hdfc-millennia' THEN 50
    WHEN 'axis-edge' THEN 50
    WHEN 'amex-india-mr' THEN 75
    WHEN 'air-india' THEN 100
    WHEN 'indigo-6e' THEN 30
    WHEN 'taj-innercircle' THEN 80
  END,
  'manual',
  'Corrected baseline valuation for India market (paise per point)',
  CURRENT_DATE
FROM programs
WHERE geography = 'IN'
  AND slug IN ('hdfc-millennia', 'axis-edge', 'amex-india-mr', 'air-india', 'indigo-6e', 'taj-innercircle')
ON CONFLICT (program_id, effective_date, source) DO UPDATE
SET cpp_cents = EXCLUDED.cpp_cents,
    notes = EXCLUDED.notes;
