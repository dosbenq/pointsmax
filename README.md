## PointsMax

PointsMax is a Next.js + Supabase app for card strategy, wallet-aware points valuation, award search, and booking guidance across India and the US.

The repo currently has two parallel tracks:

- live product code
- production catalog expansion for cards and loyalty programs

## Repo Map

```text
src/app/                  App Router pages and API routes
src/components/           Shared UI components
src/features/             Larger product modules
src/lib/                  Business logic, integrations, helpers
supabase/migrations/      Database schema and seed migrations
scripts/                  Operational and catalog scripts
Documentation/            Engineering, ops, research, and catalog docs
public/card-art/          Self-hosted card assets
```

## Product Areas

- `Calculator`: wallet value, transfers, and points analysis
- `Award Search`: Seats.aero-backed availability plus fallback estimates
- `Card Recommender`: region-aware card strategy and reviews
- `Wallet`: saved point balances

## What Is Real Today

- card/program catalog APIs
- single-hop points calculator
- award search with real Seats.aero integration
- card recommender UI and compare/review surfaces
- affiliate tracking, Stripe wiring, analytics, and admin routes

## Biggest Known Gaps

- multi-hop transfer pathfinding
- redemption-specific value instead of static CPP only
- long-tail card economics enrichment for the expanded catalog

## Catalog Workflow

Reference data (programs, cards, earning rates, point values, transfer
partners, redemption options, booking links, hotel award charts and comparison
pages) lives as JSON in `src/data/catalog/` and ships with the build, so public
pages and the calculator keep working even if the database is down.

To change a value, edit the JSON and open a PR. `src/lib/catalog/catalog.test.ts`
checks that IDs are unique, every reference resolves, and point values use the
right unit (India in paise, everything else in US cents). Never change an
existing `id`: saved balances and affiliate clicks point at them.

Transfer bonuses are time-bound, so they stay in the database
(`transfer_bonuses`). Only rows with `is_verified = true` count; the bonus
monitor inserts detected bonuses unverified and emails `ADMIN_EMAIL`.

## Database (moving to Neon)

User data and sign-in are moving from Supabase to Postgres on Neon, with
Better Auth for Google sign-in.

- Schema: `src/lib/db/schema.ts` holds user data and sign-in tables only. To
  change it, edit the file and run `npm run db:generate`. Commit the new SQL in
  `db/migrations` and the regenerated `src/lib/db/migrations.generated.ts`.
- Migrations are applied by the app itself on first use (`src/lib/db/migrate.ts`),
  so a deploy needs no separate step.
- `DATABASE_URL` (or `POSTGRES_URL`) selects the database. Sign-in needs
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `BETTER_AUTH_SECRET`. Google's
  redirect URI is `<app origin>/api/auth/callback/google`.
- `GET /api/setup/status` reports which settings are present, whether the
  schema is applied, and a rehearsal of the Supabase copy (row counts only).
- Tests use an in-memory Postgres with the real migrations (`src/test/utils/test-db.ts`).

Older catalog research and staging files live in
[Documentation/catalog/README.md](./Documentation/catalog/README.md).

Key commands:

```bash
npm run catalog:build
npm run catalog:sql
```

These regenerate:

- catalog manifests
- official-image sourcing manifest
- legacy verification backlog
- economics enrichment backlog
- Supabase staging seed SQL

## Local Development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Useful commands:

```bash
npm run build
npm run lint
npx tsc --noEmit
npm run test
npm run preflight
```

## Key Docs

- [Documentation/README.md](./Documentation/README.md)
- [Documentation/catalog/README.md](./Documentation/catalog/README.md)
- [Documentation/engineering/01-architecture.md](./Documentation/engineering/01-architecture.md)
- [Documentation/research/02-user-jtbd.md](./Documentation/research/02-user-jtbd.md)
- [Documentation/research/10-connected-wallet-epic.md](./Documentation/research/10-connected-wallet-epic.md)
- [Documentation/supabase-automation.md](./Documentation/supabase-automation.md)

## Working Rule

Do not add new docs unless they directly help:

- build or debug the backend
- operate deployment or migrations
- maintain the catalog
- onboard another engineer into the actual codebase
