# PointsMax

> **India's first AI-powered credit card points optimizer.**
> Know your best redemption before you transfer.

PointsMax helps credit card holders — starting with India's premium card users — understand the real value of their points and find the optimal redemption path. Most HDFC Infinia holders redeem at ₹0.33/pt via statement credit. PointsMax shows them the Air India business class transfer worth ₹1.50+/pt.

**Live:** _deploying_ · **Repo:** `github.com/dosbenq/pointsmax` · **Stack:** Next.js 16 · Supabase · Gemini + Claude · Inngest

---

## Table of Contents

- [Business Context](#business-context)
- [Product Status](#product-status)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Deployment](#deployment)
- [Sprint Tracker](#sprint-tracker)
- [External Services Checklist](#external-services-checklist)
- [Known Issues](#known-issues)

---

## Business Context

### Strategy
- **Primary market: India.** No equivalent of TPG/NerdWallet exists for Indian credit card rewards. HDFC Infinia, Axis Atlas, and Amex India MR holders are educated, high-income, and underserved.
- **Secondary market: US.** Competitive but included for completeness and US-based users.
- **Revenue model:** (1) Affiliate commissions on card applications, (2) Stripe Pro tier (live award availability + alerts).
- **Acquisition:** Programmatic SEO (auto-generated card/program pages from DB) + YouTube creator partnerships via `?ref=creator-slug` tracking.
- **Zero manual ops goal:** Everything that runs after launch is automated — valuations, transfer bonus monitoring, affiliate link health checks, email drip, Supabase keepalive.

### Why Points Are Hard
Indian credit card points have no standardised valuation. 1 HDFC Infinia point could be worth ₹0.33 (statement credit), ₹0.50 (Amazon voucher), or ₹1.50+ (Air India business class transfer). PointsMax calculates the optimal path and explains the transfer mechanics.

---

## Product Status

| Feature | Status | Notes |
|---|---|---|
| Points calculator (US + India) | ✅ Live | Multi-program, wallet-aware ranking |
| AI advisor (Gemini) | ✅ Live | Streams recommendations, open to all users |
| Award search | ✅ Live | Seats.aero (live) + stub estimates (fallback) |
| Card recommender | ✅ Live | Filtered by region (US / India) |
| Earning calculator | ✅ Live | Shows effective earn rate per card |
| Trip builder | ✅ Live | Multi-leg trip planning |
| Programmatic SEO pages | ✅ Live | `/[region]/cards/[slug]`, `/[region]/programs/[slug]` |
| Sitemap + JSON-LD | ✅ Live | Auto-generated from DB |
| India landing page | ✅ Live | Differentiated copy, India cards, INR |
| Shareable trip URLs | ✅ Live | Public, no login required |
| Social proof counter | ✅ Live | Real DB stats, cached 1h |
| Admin dashboard | ✅ Live | Users, programs, bonuses, audit log, link health |
| PostHog analytics | ✅ Wired | Needs `NEXT_PUBLIC_POSTHOG_KEY` |
| Stripe checkout | ✅ Wired | Needs `STRIPE_*` keys |
| Email onboarding drip | ✅ Wired | Needs `RESEND_API_KEY` |
| Creator affiliate tracking | ✅ Wired | `?ref=slug` → cookie → DB |
| Sentry error monitoring | ✅ Wired | Needs `NEXT_PUBLIC_SENTRY_DSN` |
| Supabase keepalive | ✅ Wired | GitHub Actions, needs `APP_URL` secret |
| TPG valuations scraper | ✅ Wired | Monthly Inngest cron (US programs only) |
| Transfer bonus monitor | ✅ Wired | Daily Inngest cron, Doctor of Credit |
| Affiliate link health check | ✅ Wired | Weekly Inngest cron |
| Dark mode | ⚠️ Partial | Toggle works; hardcoded colors break some pages |
| Indian valuations | ⚠️ Incorrect | Values need correction + INR scraper (Sprint 13) |
| How it works page | ⚠️ Stale | Content not region-aware (Sprint 13) |
| Upstash rate limiting | 🔲 Blocked | Needs `UPSTASH_REDIS_REST_*` keys |
| Live award availability | 🔲 Blocked | Needs Seats.aero API key |
| India valuations scraper | 🔜 Planned | Sprint 13 — cardexpert.in + technofino.in via Gemini |
| Landing page value widget | 🔜 Planned | Sprint 14 — no-signup quick calculator |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel Edge                             │
│  middleware.ts — CORS · session refresh · IP geo-routing        │
│                 ?ref= creator cookie · X-Request-Id             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   /us/* pages      /in/* pages      /api/* routes
   (static/SSR)    (static/SSR)    (serverless fns)
          │                │                │
          └────────────────┼────────────────┘
                           ▼
              ┌────────────────────────┐
              │   Supabase (Postgres)  │
              │   Auth · RLS · pgvector│
              │   20 migrations        │
              └────────────┬───────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
      Gemini AI       Anthropic        Inngest
    (advisor+SEO)   (expert chat)  (background jobs)
```

### Regional Routing
All user-facing pages live under `/[region]/` (either `us` or `in`). The middleware reads `x-vercel-ip-country` and redirects `/` → `/us` or `/in` automatically. Creator ref cookies (`?ref=creator-slug`) are preserved across the redirect.

### AI Stack
- **Gemini** (primary): points advisor, award search narrative, India valuations extraction
- **Claude/Anthropic**: expert chat mode (knowledge base Q&A)
- **Knowledge base**: pgvector semantic search, ingested from YouTube via weekly Inngest cron

### Background Jobs (all via Inngest — no Vercel cron required)
| Job | Schedule | What it does |
|---|---|---|
| `youtube-learner` | Weekly Mon | Ingests travel YouTube channels into knowledge base |
| `bonus-curator` | Daily 10am UTC | Sends transfer bonus email alerts to subscribers |
| `transfer-bonus-monitor` | Daily 7am UTC | Scrapes Doctor of Credit, flags new bonuses for admin |
| `update-valuations` (TPG) | 1st of month | Scrapes TPG for US program CPP values |
| `india-valuations-scraper` | 1st of month | Scrapes cardexpert.in + technofino.in via Gemini (planned) |
| `link-checker` | Weekly Mon | Checks all affiliate URLs, flags broken ones |
| `onboarding-drip` | Hourly | Sends welcome/D2/D7 emails to new signups |

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Turbopack, React 19 |
| Styling | Tailwind CSS v3 + shadcn/ui | `darkMode: 'class'`, CSS variables |
| Database | Supabase (Postgres + pgvector) | 20 migrations, RLS on all tables |
| Auth | Supabase Auth (SSR) | Email/password, session refresh in middleware |
| AI — Advisor | Google Gemini 2.0 Flash | Streamed responses, fallback model chain |
| AI — Expert | Anthropic Claude | Knowledge base Q&A |
| Background jobs | Inngest | Replaces Vercel cron (free tier sufficient) |
| Email | Resend | Transactional + drip |
| Payments | Stripe | Checkout + Customer Portal + webhooks |
| Analytics | PostHog | 5 key events tracked |
| Error tracking | Sentry | `withSentryConfig` wrapper, client + server |
| Rate limiting | Upstash Redis | Per-IP, fallback to in-memory |
| Testing | Vitest + Testing Library | Unit tests for calculate, cards, stripe |
| Deployment | Vercel | Hobby plan (no cron needed — Inngest handles it) |

---

## Local Development

### Prerequisites
- Node.js 20+
- A Supabase project (free tier is fine)
- A Google AI Studio account (for Gemini key)

### Setup

```bash
# 1. Clone
git clone https://github.com/dosbenq/pointsmax.git
cd pointsmax

# 2. Install dependencies
npm install

# 3. Copy env template
cp .env.local.example .env.local
# Fill in at minimum: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY

# 4. Apply DB migrations (requires Supabase CLI)
npx supabase db push

# 5. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — middleware will redirect to `/us` or `/in` based on IP.

### Useful commands

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build (run before pushing)
npm run test         # Vitest unit tests
npm run lint         # ESLint
npm run type-check   # tsc --noEmit

# Supabase helpers
npm run supabase:verify   # check local vs remote schema drift
npm run supabase:apply    # apply pending migrations

# Smoke tests (run against a live URL)
APP_URL=https://your-app.vercel.app npm run smoke:http
```

### Award search without Seats.aero key
Set `ALLOW_STUB_AWARD_SEARCH=1` in `.env.local` to use estimated award data. The UI shows a clear "estimates only" banner.

---

## Environment Variables

See `.env.local.example` for all variables with descriptions. Minimum required for local dev:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI (required — get free key from Google AI Studio)
GEMINI_API_KEY=

# Dev only
ALLOW_STUB_AWARD_SEARCH=1
DISABLE_GEMINI=   # set to 1 to skip AI calls entirely
```

All other variables (Stripe, Resend, PostHog, Sentry, Upstash, Inngest) are optional for local development — the app degrades gracefully without them.

---

## Database

### Migrations (run in order)
| Migration | What it does |
|---|---|
| `001_initial_schema` | Core tables: programs, cards, valuations, redemption_options, transfer_partners |
| `002_auth_preferences` | User preferences, alert subscriptions |
| `003_cards_and_alerts` | Transfer bonuses, card earning rates |
| `004_users_rls` | Row-level security policies for all user data |
| `005_card_affiliate_urls` | Affiliate URL column on cards |
| `006_india_programs` | 6 Indian loyalty programs + geography column on programs |
| `007_india_cards` | 7 Indian credit cards (HDFC Infinia, Axis Atlas, Amex India, etc.) |
| `008_affiliate_clicks` | Affiliate click tracking table |
| `009_security_hardening_rls` | RLS hardening pass |
| `010_flight_watches` | Flight watch alerts |
| `011_fix_india_valuations` | Corrects India valuations to paise units |
| `012_knowledge_base` | AI knowledge base (pgvector) |
| `013_vector_search_rpc` | Vector similarity search RPC function |
| `014_knowledge_hardening` | Knowledge base RLS + indexes |
| `015_link_health_log` | Affiliate link health check results |
| `016_creator_links` | Creator affiliate tracking (creators table + FK on affiliate_clicks) |
| `017_shared_trips` | Shareable trip URL snapshots |
| `018_onboarding_email_log` | Tracks which drip emails have been sent per user |
| `019_transfer_bonus_automation` | Auto-detected/verified columns on transfer_bonuses |
| `020_admin_audit_log` | Admin action audit trail |

### Key views
- `latest_valuations` — one CPP row per program (latest by effective_date)
- `active_bonuses` — transfer bonuses where active = true AND verified = true
- `site_stats` — aggregate counts for social proof counter

---

## Deployment

### Vercel setup
1. Import `dosbenq/pointsmax` from GitHub
2. Set **Root Directory** to `pointsmax`
3. Framework: Next.js (auto-detected)
4. Add all env vars from `.env.local.example` in Vercel dashboard → Settings → Environment Variables
5. Deploy

### After first deploy
1. Set GitHub Actions secrets (repo → Settings → Secrets → Actions):
   - `APP_URL` → your Vercel URL (used by Supabase keepalive)
   - `SUPABASE_ACCESS_TOKEN` → from supabase.com/dashboard/account/tokens
   - `SUPABASE_PROJECT_REF` → your project ref (the subdomain in your Supabase URL, e.g. `abcdefghijklm`)
   - `SUPABASE_DB_PASSWORD` → your Supabase database password
2. Register Inngest app: Inngest dashboard → Apps → Sync → `https://your-app.vercel.app/api/inngest`
3. Register Stripe webhook: Stripe dashboard → Developers → Webhooks → `https://your-app.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`

### Staying within free tier (target: <$15/month total)
| Service | Free limit | Our usage |
|---|---|---|
| Vercel Hobby | 100GB bandwidth | Well within for MVP |
| Supabase Free | 500MB DB, 50k MAU | Fine for launch; keepalive prevents pause |
| Inngest Free | 50k function runs/month | ~200 runs/month from crons |
| PostHog Free | 1M events/month | Fine for launch |
| Sentry Free | 5k errors/month | Fine for launch |
| Upstash Free | 10k commands/day | Fine for rate limiting at small scale |
| Resend Free | 3k emails/month | Fine for drip + alerts at launch |
| Stripe | 0 monthly fee | 2.9% + 30¢ per transaction only |
| Domain | ~$12/year | Only real fixed cost |

---

## Sprint Tracker

### ✅ Completed

| Sprint | Tasks | Summary |
|---|---|---|
| Sprint 1 | T1, T2 | Removed premium gate from AI advisor; softened calculator-first requirement |
| Sprint 2 | T3, T4 | TPG valuations scraper (monthly Inngest); admin valuation override UI |
| Sprint 3 | T5, T6 | Indian credit cards in DB; geography filter on cards API and UI |
| Sprint 4 | T7, T8, T9 | Award search graceful degradation; affiliate click tracking; pricing page updated |
| Sprint 5 | A1–A5 | Inngest crons (no Vercel Pro needed); Supabase keepalive; /api/health; Sentry wired; link health checker |
| Sprint 6 | S1–S4 | Programmatic card + program SEO pages; auto sitemap; JSON-LD structured data |
| Sprint 7 | R1–R4 | PostHog; Stripe checkout + webhook; email drip (3 emails); creator affiliate links |
| Sprint 8 | D1, D2 | Transfer bonus monitor (daily cron); admin verification UI |
| Sprint 9 | G1–G3 | Shareable trips; social proof counter; India-differentiated landing page |

### 🔄 In Progress (Codex)

| Sprint | Tasks | Summary |
|---|---|---|
| Sprint 10 | P1–P4 | Performance: connection pooling, async award narrative, loading skeletons, ISR |
| Sprint 11 | U1–U5 | UI polish: shadcn/ui, Framer Motion, dark mode, Geist font, empty/error states |
| Sprint 12 | C1–C4 | Compliance: account deletion, billing portal, admin audit log, admin rate limiting |

### 🔜 Planned (next)

| Sprint | Tasks | Summary |
|---|---|---|
| Sprint 13 | F1–F4 | **India data integrity** — dark mode fix, correct Indian valuations + INR scraper, How It Works revamp, USD currency audit |
| Sprint 14 | X1–X2 | **Content** — hero copy rewrite, no-signup value widget on landing page |

---

## External Services Checklist

_To be completed by PM before launch._

| Service | Status | Env Var(s) |
|---|---|---|
| **Vercel** (hosting) | 🔲 Todo | — (deploy from GitHub) |
| **Supabase** (DB + Auth) | ✅ Done | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Supabase pooled URL** (perf) | 🔲 Todo | `SUPABASE_DB_URL_POOLED` |
| **Google Gemini** (AI) | ✅ Done | `GEMINI_API_KEY` |
| **Anthropic** (AI) | ✅ Done | `ANTHROPIC_API_KEY` |
| **Inngest** (workflows) | 🔲 Todo | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` |
| **Resend** (email) | 🔲 Todo | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| **Stripe** (payments) | 🔲 Todo | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRO_PRICE_ID` |
| **Upstash Redis** (rate limiting) | 🔲 Todo | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Sentry** (errors) | 🔲 Todo | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |
| **PostHog** (analytics) | 🔲 Todo | `NEXT_PUBLIC_POSTHOG_KEY` |
| **Seats.aero** (live awards) | 🔲 Blocked | `SEATS_AERO_API_KEY` — contact seats.aero for partner access |
| **Domain** | 🔲 Todo | ~$12/year on Namecheap or Cloudflare |
| **GitHub secret** (`APP_URL`) | 🔲 Todo | Set in repo → Settings → Secrets → Actions |
| **`CRON_SECRET`** | 🔲 Todo | Generate: `openssl rand -base64 32` |

---

## Known Issues

| Issue | Severity | Sprint | Notes |
|---|---|---|---|
| Dark mode: hardcoded colors break on some pages | High | Sprint 13 / F1 | NavBar, calculator, landing use `bg-[#hex]` instead of CSS vars |
| Indian point valuations are incorrect | High | Sprint 13 / F2 | Current seeds are wrong; INR scraper not yet built |
| How It Works page shows US programs to India users | High | Sprint 13 / F3 | Content hardcoded; needs dynamic DB-driven copy |
| USD shown on some India pages | Medium | Sprint 13 / F4 | Pricing, stats, CPP display needs currency audit |
| Upstash not provisioned → rate limiting inactive | Medium | Blocked | Set `UPSTASH_REDIS_REST_*` to activate; in-memory fallback active |
| Seats.aero key missing → only stub award data | Medium | Blocked | Contact seats.aero; stub estimates show with banner |
| All Stripe/Resend/PostHog/Sentry keys missing | Medium | Blocked | Features wired, just need keys from PM |

---

## CI/CD Pipeline

Every push and PR runs the full automated pipeline. **Nothing reaches production without passing all gates.**

```
Developer pushes branch
        │
        ▼
┌───────────────────────────────────┐
│  CI (on every push + PR)          │  ← blocks merge if any step fails
│  1. ESLint                        │
│  2. TypeScript check (tsc)        │
│  3. Unit tests (Vitest)           │
│  4. Production build              │
│  5. HTTP smoke test               │
│  6. Migration numbering check     │
└───────────────────────────────────┘
        │ (merge to main)
        ▼
┌───────────────────────────────────┐
│  Vercel                           │  ← auto-deploys on main push
│  Builds + deploys to production   │
└───────────────────────────────────┘
        │ (if migration files changed)
        ▼
┌───────────────────────────────────┐
│  migrate.yml                      │  ← zero manual DB work
│  supabase db push --linked        │
│  Post-migration schema check      │
└───────────────────────────────────┘
        │ (every 5 days)
        ▼
┌───────────────────────────────────┐
│  supabase-keepalive.yml           │  ← prevents free tier DB pause
│  curl /api/health                 │
└───────────────────────────────────┘
```

### Workflow files
| File | Trigger | Purpose |
|---|---|---|
| `ci.yml` | Every push + PR | Lint, types, tests, build, smoke, migration numbering |
| `migrate.yml` | Push to main (migrations changed) | Auto-apply DB migrations to production |
| `supabase-keepalive.yml` | Every 5 days | Ping /api/health to prevent Supabase free tier pause |
| `automation-watchdog.yml` | Scheduled | Monitor Inngest function health |
| `link-health.yml` | Scheduled | Check affiliate link status |
| `release-gate.yml` | Manual dispatch | Full preflight before a major release |

### Required GitHub Secrets
| Secret | Where to get it | Used by |
|---|---|---|
| `APP_URL` | Your Vercel URL | keepalive, smoke tests |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens | migrate.yml |
| `SUPABASE_PROJECT_REF` | Supabase project URL subdomain | migrate.yml |
| `SUPABASE_DB_PASSWORD` | Supabase → Settings → Database | migrate.yml |

---

## Contributing

This project uses:
- **Codex** for sprint implementation (tasks defined in `CODEX_TASKS.md`)
- **Claude Code** for architecture, code review, and planning

### Developer workflow (for all contributors including Codex and Kimi)
1. **Never push directly to `main`** — always work on a branch
2. Open a PR — CI runs automatically (lint + typecheck + tests + build)
3. PR cannot merge if CI fails — this is enforced
4. Once merged, Vercel deploys automatically and migrations apply automatically

### Before starting any task
1. Read the full task description in `CODEX_TASKS.md` — do not skim
2. Read every file you plan to change — do not modify code you haven't read
3. Run `npm run build` locally before opening a PR
4. Each task has explicit acceptance criteria — verify all of them

### Code review checklist
- [ ] `npm run build` passes with zero warnings
- [ ] No hardcoded secrets or API keys
- [ ] No `any` TypeScript types introduced
- [ ] New migrations are numbered sequentially (CI enforces this automatically)
- [ ] No `console.log` left in production code
- [ ] Region-aware: India pages show ₹, US pages show $

---

_Last updated: February 2026_
