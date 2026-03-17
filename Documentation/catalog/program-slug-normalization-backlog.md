# Program Slug Normalization Backlog

Date: March 16, 2026

This backlog tracks where the live repo still uses stale or overly coarse program slugs while the new staging catalog has more current names.

## India Priority Mappings

These are the highest-priority India-side updates.

### Current repo slug: `air-india`

- Current label in repo: `Air India Maharaja Club`
- Recommended canonical slug: `air-india-maharaja-club`
- Why: current name is already correct, but slug should be made explicit before the larger catalog seed lands

### Current repo slug: `indigo-6e`

- Current label in repo: `IndiGo 6E Rewards`
- Recommended canonical slug: `indigo-bluchip`
- Why: public program naming is now BluChip

### Current repo slug: `taj-innercircle`

- Current label in repo: `Taj InnerCircle`
- Recommended canonical slug: `tata-neu-hotels`
- Why: the production catalog should model the Tata Neu / IHCL hotel layer rather than the stale legacy standalone framing

### Current repo slug: `hdfc-millennia`

- Current label in repo: `HDFC Millennia Rewards`
- Recommended next-state handling: split into more precise HDFC program families where card economics justify it
- Why: the current slug is too coarse for the new HDFC catalog

### Current repo slug: `axis-edge`

- Current label in repo: `Axis EDGE Rewards`
- Recommended next-state handling: keep `axis-edge-rewards` and add `axis-edge-miles` as a separate program
- Why: Atlas-style travel value needs its own program identity

### Current repo slug: `amex-india-mr`

- Current label in repo: `Amex Membership Rewards India`
- Recommended canonical slug: `amex-membership-rewards-india`
- Why: naming consistency with the broader seed catalog

## Impacted Files Identified

These files still reference the older India slug set and should be updated during the seed/migration pass:

- `supabase/migrations/006_india_programs.sql`
- `supabase/migrations/021_india_valuations_fix.sql`
- `supabase/migrations/023_fix_program_geography.sql`
- `supabase/migrations/024_booking_urls.sql`
- `supabase/migrations/031_refresh_booking_urls.sql`
- `src/lib/regions.ts`
- `src/lib/award-search/award-charts.ts`
- `src/lib/inngest/functions/india-valuations-scraper.ts`
- `src/app/api/cron/update-valuations/route.ts`
- `src/app/api/ai/recommend/route.ts`

## Execution Rule

Do not partially rename slugs in app code before the DB seed/migration pass is ready.

The safe order is:

1. create alias mapping or migration strategy
2. update DB seed data
3. update app references
4. update tests
5. remove temporary aliases once all data is migrated
