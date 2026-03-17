# Catalog Docs

This folder is the working source of truth for the expanding India and US card/program catalog.

Keep this folder lean and operational:

- staging catalogs
- seed manifests
- image-sourcing manifest
- verification backlog
- economics-enrichment backlog
- slug-normalization backlog

## Core Files

- `india-card-catalog-staging.csv`
- `india-program-catalog-staging.csv`
- `us-card-catalog-staging.csv`
- `us-program-catalog-staging.csv`
- `card-seed-manifest.csv`
- `program-seed-manifest.csv`
- `card-official-image-source-manifest.csv`
- `legacy-verify-backlog.csv`
- `card-economics-enrichment-backlog.csv`
- `program-slug-normalization-backlog.md`
- `catalog-readiness-status.md`
- `official-card-image-sourcing-brief.md`

## Regeneration

Run:

```bash
npm run catalog:build
npm run catalog:sql
```

That regenerates the derived manifests and the catalog staging seed migration.
