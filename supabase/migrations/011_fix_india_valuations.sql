-- ============================================================
-- PointsMax — Migration 011
-- Fix: India card valuations (Rupees to Paise)
-- ============================================================

-- 1) Increase precision for cpp_cents columns to allow values >= 100 (e.g. 100 paise = 1 INR)
ALTER TABLE public.valuations ALTER COLUMN cpp_cents TYPE NUMERIC(10,4);
ALTER TABLE public.redemption_options ALTER COLUMN cpp_cents TYPE NUMERIC(10,4);

-- 2) Update India valuations (Multiply by 100 to convert Rupee-based entries to Paise)
-- This fixes the 100x discrepancy in the earning calculator and redemption engine.
UPDATE public.valuations
SET cpp_cents = cpp_cents * 100
WHERE program_id IN (
  SELECT id FROM public.programs WHERE geography = 'IN'
);

-- 3) Update India redemption options (Multiply by 100 to convert Rupee-based entries to Paise)
UPDATE public.redemption_options
SET cpp_cents = cpp_cents * 100
WHERE program_id IN (
  SELECT id FROM public.programs WHERE geography = 'IN'
);
