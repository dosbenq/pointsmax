-- Document: transfer_bonuses has both 'verified' and 'is_verified' columns.
-- 'is_verified' is the original (migration 001), 'verified' was added in migration 019.
-- The active_bonuses view uses COALESCE on both. Application code should use 'is_verified' as canonical.
-- TODO: Consolidate in a future migration by dropping 'verified' column after updating all references.
COMMENT ON COLUMN transfer_bonuses.verified IS 'DEPRECATED: Use is_verified instead. Both columns serve the same purpose.';
