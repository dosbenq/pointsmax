-- ============================================================
-- PointsMax — Migration 033
-- Normalize any legacy India CPP valuations into paise at rest
-- ============================================================

-- Runtime heuristics for INR CPP units have been removed.
-- After this migration, India program valuations must be stored in paise/point.
-- Example: 0.50 INR/pt => 50, 1.20 INR/pt => 120.

UPDATE valuations AS v
SET cpp_cents = v.cpp_cents * 100,
    notes = CASE
      WHEN COALESCE(v.notes, '') = '' THEN 'Normalized from legacy INR-per-point units to paise per point'
      ELSE v.notes || ' | normalized to paise per point'
    END
FROM programs AS p
WHERE p.id = v.program_id
  AND p.geography = 'IN'
  AND v.cpp_cents > 0
  AND v.cpp_cents < 10;
