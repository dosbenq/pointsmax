# Catalog Readiness Status

Date: March 16, 2026

## Done

- India staging card catalog created
- India staging program catalog created
- US staging card catalog created
- US staging program catalog created
- seed-ready manifests generated
- official-image sourcing manifest generated
- legacy verification backlog generated
- economics enrichment backlog generated

## Current Files

- `Documentation/catalog/card-seed-manifest.csv`
- `Documentation/catalog/program-seed-manifest.csv`
- `Documentation/catalog/card-official-image-source-manifest.csv`
- `Documentation/catalog/legacy-verify-backlog.csv`
- `Documentation/catalog/card-economics-enrichment-backlog.csv`

## What This Means

The catalog perimeter is now broad enough for production planning across India and the US.

What is ready now:

- canonical card names
- canonical program names
- official-source provenance per row
- source-confidence flags
- verification holds for risky legacy rows
- seed-ready slugs and asset slugs

What is not finished yet:

- structured card economics for the full long tail
- official image asset extraction and self-hosting
- final Supabase seed SQL / migration inserts
- full program-slug normalization inside the live app and DB

## Next Execution Order

1. review and resolve `legacy-verify-backlog.csv`
2. enrich `card-economics-enrichment-backlog.csv`
3. generate migration-ready SQL from the seed manifests
4. fetch and self-host official card images from `card-official-image-source-manifest.csv`
5. normalize stale slugs and names in live code and DB

## Important Constraint

Do not expose all staged cards in recommendation flows until their economics row is enriched and verified.
