-- ============================================================
-- PointsMax — Migration 017
-- Shareable calculator/trip snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shared_trips (
  id          TEXT PRIMARY KEY,
  region      TEXT NOT NULL,
  trip_data   JSONB NOT NULL,
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_trips_created_at
  ON public.shared_trips (created_at DESC);
