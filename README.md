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
- `Wallet`: manual balances, CSV import, connector framework
- `Booking Guide`: persisted workflow with Inngest orchestration

## What Is Real Today

- card/program catalog APIs
- single-hop points calculator
- award search with real Seats.aero integration
- booking-guide persistence flow
- card recommender UI and compare/review surfaces
- affiliate tracking, Stripe wiring, analytics, and admin routes

## Biggest Known Gaps

- multi-hop transfer pathfinding
- redemption-specific value instead of static CPP only
- booking guide context injection
- real wallet/provider connectors
- long-tail card economics enrichment for the expanded catalog

## Catalog Workflow

Catalog work lives in [Documentation/catalog/README.md](/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/Documentation/catalog/README.md).

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

- [Documentation/README.md](/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/Documentation/README.md)
- [Documentation/catalog/README.md](/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/Documentation/catalog/README.md)
- [Documentation/engineering/01-architecture.md](/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/Documentation/engineering/01-architecture.md)
- [Documentation/research/02-user-jtbd.md](/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/Documentation/research/02-user-jtbd.md)
- [Documentation/research/10-connected-wallet-epic.md](/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/Documentation/research/10-connected-wallet-epic.md)
- [Documentation/supabase-automation.md](/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/Documentation/supabase-automation.md)

## Working Rule

Do not add new docs unless they directly help:

- build or debug the backend
- operate deployment or migrations
- maintain the catalog
- onboard another engineer into the actual codebase
