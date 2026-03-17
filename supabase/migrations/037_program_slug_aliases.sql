-- ============================================================
-- PointsMax — Migration 037
-- Program slug aliases for catalog normalization
-- ============================================================

INSERT INTO public.program_slug_aliases (alias_slug, canonical_slug, geography, notes)
VALUES
  ('air-india', 'air-india-maharaja-club', 'IN', 'Existing repo slug retained as alias for explicit canonical name'),
  ('indigo-6e', 'indigo-bluchip', 'IN', 'Old 6E Rewards naming mapped to BluChip'),
  ('taj-innercircle', 'tata-neu-hotels', 'IN', 'Legacy Taj InnerCircle slug mapped to Tata Neu hotel layer'),
  ('amex-india-mr', 'amex-membership-rewards-india', 'IN', 'Normalize India Amex slug naming'),
  ('axis-edge', 'axis-edge-rewards', 'IN', 'Normalize Axis rewards family slug'),
  ('hdfc-millennia', 'hdfc-millennia-cashpoints', 'IN', 'Normalize HDFC Millennia cashback family slug')
ON CONFLICT (alias_slug) DO UPDATE SET
  canonical_slug = EXCLUDED.canonical_slug,
  geography = EXCLUDED.geography,
  notes = EXCLUDED.notes;
