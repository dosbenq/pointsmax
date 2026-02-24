-- ============================================================-- PointsMax — Migration 021-- Fix: Correct Indian program valuations (paise per point)-- ============================================================
-- Note: Values are stored in PAUSE (1 INR = 100 paise)
-- Correct seed values based on market research:
-- - HDFC Millennia: ₹0.50/pt blended (conservative average)
-- - Axis EDGE: ₹0.50/pt (similar to HDFC structure)
-- - Amex India MR: ₹0.75/pt (better airline partners)
-- - Air India: ₹1.00/mile (business class awards average)
-- - IndiGo 6E: ₹0.30/pt (limited redemption options)
-- - Taj InnerCircle: ₹0.80/pt (hotel redemptions average)

-- First, ensure precision is sufficient
ALTER TABLE public.valuations ALTER COLUMN cpp_cents TYPE NUMERIC(10,4);

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
