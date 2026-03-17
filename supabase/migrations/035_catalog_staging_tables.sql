-- ============================================================
-- PointsMax — Migration 035
-- Production catalog staging tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.catalog_programs_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  program_name TEXT NOT NULL,
  short_name_candidate TEXT NOT NULL,
  program_kind TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  program_slug_candidate TEXT NOT NULL,
  geography TEXT NOT NULL,
  catalog_status TEXT NOT NULL,
  source_confidence TEXT NOT NULL,
  seed_readiness TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region, program_slug_candidate)
);

CREATE INDEX IF NOT EXISTS idx_catalog_programs_staging_region
  ON public.catalog_programs_staging (region, catalog_status);

CREATE TABLE IF NOT EXISTS public.catalog_cards_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  card_name TEXT NOT NULL,
  card_slug_candidate TEXT NOT NULL,
  program_name TEXT NOT NULL,
  program_slug_candidate TEXT NOT NULL,
  geography TEXT NOT NULL,
  currency TEXT NOT NULL,
  earn_unit TEXT NOT NULL,
  catalog_status TEXT NOT NULL,
  source_confidence TEXT NOT NULL,
  seed_readiness TEXT NOT NULL,
  image_asset_slug TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_scope TEXT NOT NULL,
  official_image_strategy TEXT NOT NULL DEFAULT 'fetch_official_asset_then_self_host',
  official_image_status TEXT NOT NULL DEFAULT 'pending_asset_extraction',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region, card_slug_candidate)
);

CREATE INDEX IF NOT EXISTS idx_catalog_cards_staging_region
  ON public.catalog_cards_staging (region, catalog_status);

CREATE TABLE IF NOT EXISTS public.program_slug_aliases (
  alias_slug TEXT PRIMARY KEY,
  canonical_slug TEXT NOT NULL,
  geography TEXT NOT NULL DEFAULT 'global',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_slug_aliases_canonical
  ON public.program_slug_aliases (canonical_slug);
