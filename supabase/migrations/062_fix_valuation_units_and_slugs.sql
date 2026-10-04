-- ============================================================
-- PointsMax — Migration 062
-- Repair valuation rows written after 033 in the wrong units,
-- and an Apr 2026 update that targeted a non-existent slug.
-- ============================================================

-- 1) India valuations are stored in paise per point (see 033).
--    Migrations 043 and 057 inserted INR-per-point values (e.g. 1.20 for
--    HDFC SmartBuy instead of 120), which became the "latest" valuation and
--    made India results ~100x too low. Re-apply the 033 normalization.
--    No real India programme is worth less than 10 paise/pt, so any value
--    below 10 is unambiguously in INR.
UPDATE valuations AS v
SET cpp_cents = v.cpp_cents * 100,
    notes = CASE
      WHEN COALESCE(v.notes, '') = '' THEN 'Normalized from INR-per-point units to paise per point (062)'
      ELSE v.notes || ' | normalized to paise per point (062)'
    END
FROM programs AS p
WHERE p.id = v.program_id
  AND p.geography = 'IN'
  AND v.cpp_cents > 0
  AND v.cpp_cents < 10;

-- 2) 057 updated slug 'avios', which does not exist; the programme is
--    'british-airways'. Apply the intended TPG Apr 2026 value.
UPDATE valuations
SET cpp_cents = 1.40,
    notes = 'TPG Apr 2026. Dec 2025 deval: 8-14% more Avios needed.'
WHERE program_id = (SELECT id FROM programs WHERE slug = 'british-airways' LIMIT 1);
