-- Add the unique constraint that migration 049's ON CONFLICT clause expects
CREATE UNIQUE INDEX IF NOT EXISTS idx_inspiration_routes_unique
  ON inspiration_routes (region, origin_iata, destination_iata, cabin, program_slug, headline);
