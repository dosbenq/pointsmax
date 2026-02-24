# PointsMax — Codex Task Backlog

> PM notes in **bold**. Tasks are ordered by priority within each sprint.
> Do not re-implement things that are already working. Read the referenced files before touching them.

---

## Sprint 1 — Cleanup (unblock UX, no new features)

### T1 · Remove dead premium-gate UI from calculator

**Why**: The AI advisor premium gate was removed (server-side check deleted, `isPremiumUser` hardcoded to `true`). Several conditional blocks that previously showed "upgrade" prompts are now unreachable dead code that clutters the file.

**Files**: `src/app/calculator/page.tsx`

**What to delete** (these conditions evaluate to `false` permanently):
- Line ~1683–1685: `{!isPremiumUser && <span>Pro required</span>}` — remove the span
- Lines ~1703–1718: `{hasCalculatorResult && !isPremiumUser && <div>upgrade prompt</div>}` — remove entire block
- Lines ~1811–1824: `{) : !isPremiumUser ? (<div>upgrade CTA</div>`) — remove the ternary branch, keep only the `:` branch
- Lines ~1852–1909: The entire upgrade modal (`{showUpgradeModal && <div className="fixed inset-0 ...">...</div>}`) — remove it
- Line ~1188–1192: Inside `switchPanel`, the `if (!isPremiumUser)` guard — remove it
- Line ~1058–1061: The `if (!isPremiumUser)` guard that sets `aiError` and `showUpgradeModal` — remove it

**Also remove** the now-unused state: `const [showUpgradeModal, setShowUpgradeModal] = useState(false)` (line ~760).

**Acceptance criteria**: `npm run build` passes. No "upgrade", "Pro required", or modal code remains. The AI advisor panel is always accessible after running the calculator.

---

### T2 · Soften the "run calculator first" requirement for AI advisor

**Why**: After removing the premium gate, the AI advisor still blocks itself with "Run the calculator first to unlock AI recommendations." This creates unnecessary friction — users with balances entered should be able to ask the AI without running the full calculator.

**File**: `src/app/calculator/page.tsx`

**Current logic** (switchPanel function, ~line 1183–1186):
```typescript
if (panel === 'advisor') {
  if (!hasCalculatorResult) {
    setAiError('Run the calculator first to unlock AI recommendations.')
    return
  }
```

**Change**: Remove the hard block. Instead, let the user open the advisor panel without a calculator result. The AI can still work with just the balances they've entered. If `!hasCalculatorResult`, show a soft inline hint at the top of the advisor panel: "Add a destination in the calculator for more specific recommendations." but don't block.

**Also update** the `canUseAdvisor` derivation (line ~1170): remove the `hasCalculatorResult` requirement:
```typescript
const canUseAdvisor = true // balances are sufficient; calculator result improves recommendations
```

**Acceptance criteria**: User can open AI advisor tab immediately after entering balances, without hitting calculate. Advisor still works (sends balances to API). If no calculator result, the prompt sent to Gemini should just omit the `topResults` field.

---

## Sprint 2 — Live Data (highest ROI, no external API keys needed)

### T3 · TPG valuations scraper cron job

**Why**: All CPP (cents-per-point) values in the DB are static seeds from January 2025. The Points Guy publishes monthly updates. A monthly scrape keeps our recommendations more accurate than competitors using stale data.

**New file**: `src/app/api/cron/update-valuations/route.ts`

**Logic**:
1. Auth check: `Authorization: Bearer CRON_SECRET` header OR `?secret=CRON_SECRET` query param
2. Fetch TPG valuations page (`https://thepointsguy.com/points-miles-valuations/`)
3. Parse with `cheerio` (add `npm install cheerio`) — find the valuations table, extract program name → cpp value pairs
4. Map TPG program names to our `programs.slug` values (maintain a mapping object in the file — e.g. `"Chase Ultimate Rewards" → "chase-ur"`, `"Amex Membership Rewards" → "amex-mr"`, etc.)
5. For each matched program: `INSERT INTO valuations (program_id, cpp_cents, source, source_url, effective_date) VALUES (...) ON CONFLICT DO NOTHING` — use `source = 'tpg'` and today's date as `effective_date`
6. Return `{ ok: true, updated: N, skipped: M, unmapped: [...] }`

**Mapping needed** (at minimum): chase-ur, amex-mr, capital-one-miles, citi-thankyou, bilt, united-miles, delta-skymiles, aa-miles, southwest-points, hyatt-points, hilton-honors, marriott-bonvoy, alaska-miles, jetblue-points

**Update `vercel.json`**: Add cron entry:
```json
{ "path": "/api/cron/update-valuations", "schedule": "0 10 1 * *" }
```
(Runs on the 1st of each month at 10am UTC)

**Add `cheerio` dependency**: `npm install cheerio` + `npm install -D @types/cheerio` if needed.

**Acceptance criteria**:
- `GET /api/cron/update-valuations?secret=X` inserts new rows into `valuations` table
- `latest_valuations` view returns updated values immediately after
- If TPG page structure changes (parse fails), the route returns `{ ok: false, error: "parse failed" }` without crashing — graceful degradation

---

### T4 · Admin UI for manual valuation override

**Why**: The scraper will sometimes miss programs or get incorrect values. Admins need a way to manually set CPP without touching the DB directly.

**File**: `src/app/api/admin/valuations/route.ts` (new)

**Endpoints**:
- `GET /api/admin/valuations` — returns `latest_valuations` view (all current CPP values)
- `POST /api/admin/valuations` — body: `{ program_slug: string, cpp_cents: number, notes?: string }` → upserts into `valuations` with `source = 'manual'`

**Auth**: Same admin secret pattern as existing `src/app/api/admin/bonuses/route.ts` — check `ADMIN_SECRET` env var.

**Acceptance criteria**: POST with a valid program slug updates the value visible in the calculator immediately (via `latest_valuations` view).

---

## Sprint 3 — India Expansion

> **PM note**: Indian airports (DEL, BOM, BLR, HYD, MAA, CCU etc.) are already in `award-charts.ts` under the `SE_ASIA` group. The gap is: (a) no Indian credit cards in the `cards` table, and (b) no geography filter in the UI. Address these in order.

### T5 · Add Indian credit cards migration

**Why**: The DB has 6 Indian loyalty programs but zero Indian credit cards. The Earning Calculator and Card Recommender are completely empty for India users.

**New file**: `supabase/migrations/007_india_cards.sql`

**Cards to add** (research the exact current earn rates from each bank's website before coding — do not guess):

| Card | Program | Annual Fee (INR) |
|---|---|---|
| HDFC Infinia | HDFC Millennia Rewards | ₹12,500 |
| HDFC Regalia Gold | HDFC Millennia Rewards | ₹2,500 |
| Axis Atlas | Axis EDGE Rewards | ₹5,000 |
| Axis Ace | Axis EDGE Rewards | ₹499 |
| Amex Platinum (India) | Amex MR India | ₹60,000 |
| Amex Gold (India) | Amex MR India | ₹4,500 |
| Air India SBI Signature | Air India Maharaja Club | ₹4,999 |

**Schema changes needed first** — add to the migration:
```sql
ALTER TABLE cards ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE cards ADD COLUMN earn_unit TEXT NOT NULL DEFAULT '1_dollar';
-- earn_unit values: '1_dollar', '100_inr', '1_euro' etc.
-- This lets the UI display "per ₹100 spent" for Indian cards
```

**Earning rates**: Express as `earn_multiplier` = points per 1 unit of `earn_unit`. E.g., HDFC Infinia earns 5 points per ₹150 → per ₹100 that's 3.33 → `earn_multiplier = 3.33`, `earn_unit = '100_inr'`.

**Acceptance criteria**: After migration, `/api/cards` returns the new Indian cards. The Earning Calculator shows them. Annual fees display in INR.

---

### T6 · Geography filter — cards API and UI

**Why**: US and Indian cards should not show mixed together with no context. Users should see cards relevant to their region.

**Files to change**:

1. `src/app/api/cards/route.ts`:
   - Accept optional query param `?geography=IN` (or `US`, default `US`)
   - Add `WHERE cards.geography = $1` filter (need to add `geography TEXT DEFAULT 'US'` column to `cards` — include in T5 migration)
   - Default: return only US cards (existing behavior unchanged)

2. `src/app/earning-calculator/page.tsx`:
   - Add a region toggle: `🇺🇸 US Cards` / `🇮🇳 India Cards` (simple tab or dropdown)
   - Pass `?geography=IN` when India is selected
   - Show annual fee in INR for Indian cards (use `currency` field from card object)

3. `src/app/card-recommender/page.tsx`:
   - Same geography toggle
   - Same currency display logic

**Acceptance criteria**: Switching to India shows only Indian cards with INR fees. Switching back to US restores US cards. Default is US. No cards from the wrong region mix in.

---

## Sprint 4 — Product Quality

### T7 · Award search graceful degradation (no Seats.aero key)

**Why**: In production without `SEATS_AERO_API_KEY`, the award search throws `AwardProviderUnavailableError` which surfaces as a generic error. Users don't know why and can't take action.

**Files**: `src/app/api/award-search/route.ts` + `src/app/award-search/page.tsx` (or wherever award search errors are displayed)

**Change**: Catch `AwardProviderUnavailableError` specifically and return a clear `{ error: "real_availability_unavailable", message: "Live award availability is not configured. Showing chart estimates only.", results: [...stub_results] }`.

The stub provider should still run and return estimated results — don't show a blank error screen. Just add a prominent banner: "Showing chart estimates · Live seat availability requires API configuration."

**Acceptance criteria**: Without Seats.aero key, award search returns estimated results with a clear "estimates only" banner. No raw error messages shown to users.

---

### T8 · Affiliate click tracking

**Why**: We need to measure which cards are generating apply clicks so we know what's working and can optimize placement. Currently clicks go directly to affiliate links with no tracking.

**File**: `src/app/api/analytics/affiliate-click/route.ts` (new)

**Logic**:
- `POST /api/analytics/affiliate-click` body: `{ card_id, program_id, source_page }`
- Insert into a new `affiliate_clicks` table: `(id, card_id, user_id nullable, source_page, created_at)`
- Return `{ ok: true, redirect_url }` where `redirect_url` is the card's `apply_url`

**DB migration** `supabase/migrations/008_affiliate_clicks.sql`:
```sql
CREATE TABLE affiliate_clicks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID REFERENCES cards(id),
  user_id     UUID REFERENCES users(id), -- nullable
  source_page TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Update `src/app/card-recommender/page.tsx`**: Change "Apply Now" buttons from direct `<a href>` to fire a `POST` to this endpoint, then do a client-side redirect to the returned URL. This gives us a click event in DB before the redirect.

**Acceptance criteria**: Each "Apply Now" click inserts a row in `affiliate_clicks`. `GET /api/admin/affiliate-clicks` (add this too) returns click counts grouped by `card_id` and `source_page` for the last 30 days.

---

### T9 · Update pricing page to reflect open access

**Why**: The pricing page says "AI advisor concierge" is a Pro feature — but we just opened it to everyone. The page is now misleading.

**File**: `src/app/pricing/page.tsx`

**Change `PRO_FEATURES` constant** (line ~31):
```typescript
const PRO_FEATURES = [
  'Everything in Free',
  'Real-time award availability (Seats.aero)',  // keep — still Pro-only
  'Transfer bonus and seat alerts',             // keep
  'Priority support',                           // keep
  'Early access to new features',              // add
]
```

Remove "AI advisor concierge" from Pro features since it's now free.

**Also update `FREE_FEATURES`**:
```typescript
const FREE_FEATURES = [
  'Full points calculator',
  'AI advisor concierge',    // ADD this
  '20+ loyalty programs',
  'Award flight search',
  'Trip Builder',            // ADD this
  'Card Recommender',        // ADD this
  'Save balances & preferences',
]
```

**Update FAQ** (line ~39): Change "How much is Pro?" answer to clarify what Pro actually adds now (live seat availability, alerts).

**Acceptance criteria**: Pricing page accurately describes what's free vs Pro. No mention of AI advisor being Pro-only.

---

## Blocked — Needs Human Action First

These cannot be coded until external accounts/keys are provisioned:

| Task | Blocker | Who |
|---|---|---|
| Seats.aero live availability | Need API key from seats.aero | PM — contact seats.aero for partner access |
| Email alerts (Resend) | Need `RESEND_API_KEY` and verified sender domain | PM — sign up at resend.com |
| Stripe checkout | Need `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` | PM — create Stripe account + product |
| Rate limiting (Upstash) | Need `UPSTASH_REDIS_REST_URL` + `TOKEN` | PM — create Upstash account (free tier) |
| PostHog analytics | Need `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` | PM — create PostHog account (free tier, 1M events/month) |
| Sentry error tracking | Need `NEXT_PUBLIC_SENTRY_DSN` | PM — create Sentry account (free tier) |

---

## Out of Scope (for now)

- **Direct airline award scraping** — against ToS for most airlines, unreliable, and Seats.aero is the correct solution here.
- **Annual subscription option** — wait until monthly plan has validation.
- **Transfer bonus scraper** — moved to Sprint 8 as a monitored Inngest job; see D1.

---

## Sprint 5 — Zero-Manual Infrastructure (Pre-Launch Critical)

> **PM note**: The goal is zero human intervention after launch. Everything that currently requires manual action must become automated. Complete this sprint before going live.

### A1 · Move all scheduled jobs from Vercel cron → Inngest

**Why**: Vercel cron jobs require a Pro plan ($20/mo). Inngest scheduled functions are free (50k runs/month) and already integrated. The three crons in `vercel.json` must move entirely to Inngest.

**Current state**: `vercel.json` defines 3 crons that hit API routes. Inngest functions exist in `src/lib/inngest/functions/` but are not yet scheduled there.

**What to do**:
1. In each Inngest function (`youtube-learner.ts`, `bonus-curator.ts`), add a `cron` trigger using the Inngest `schedules.every` / `onSchedule` API
2. Remove all entries from the `crons` array in `vercel.json`
3. The API routes (`/api/cron/*`) can stay as manual-trigger fallbacks but should no longer be the primary scheduler
4. Add `CRON_SECRET` check to each route as a manual-only safeguard

**Acceptance criteria**: `vercel.json` has an empty `crons: []`. All three jobs fire on schedule via Inngest dashboard. No Vercel Pro plan required.

---

### A2 · Supabase keepalive via GitHub Actions

**Why**: Supabase free tier pauses your database after 7 days of inactivity. If this happens in production, the site goes down silently.

**New file**: `.github/workflows/supabase-keepalive.yml`

**Logic**:
```yaml
on:
  schedule:
    - cron: '0 8 */5 * *'   # every 5 days at 8am UTC
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping health endpoint
        run: curl -f ${{ secrets.APP_URL }}/api/health
```

The `/api/health` endpoint (A3) must exist first.

**GitHub secret needed**: `APP_URL` (set to production URL in GitHub repo settings — one-time human action).

**Acceptance criteria**: GitHub Actions tab shows successful runs every 5 days. Supabase project stays active indefinitely.

---

### A3 · `/api/health` endpoint

**Why**: Single endpoint that verifies all critical services are reachable. Used by the keepalive cron (A2), monitoring tools, and uptime checkers.

**New file**: `src/app/api/health/route.ts`

**Logic**:
- `GET /api/health`
- Check 1: Supabase — run `SELECT 1` query
- Check 2: Gemini — verify `GEMINI_API_KEY` env var is set (do not make a live API call on every health check)
- Check 3: Inngest — verify `INNGEST_EVENT_KEY` env var is set
- Return `{ ok: true, checks: { db: "ok", ai: "ok", inngest: "ok" }, timestamp }` with 200
- If any check fails, return `{ ok: false, checks: {...}, error: "..." }` with 503

**Acceptance criteria**: `GET /api/health` returns 200 with all checks passing on a correctly configured environment.

---

### A4 · Sentry error monitoring

**Why**: Without error tracking, production bugs are invisible. Sentry's free tier (5k errors/month) is sufficient for MVP. `NEXT_PUBLIC_SENTRY_DSN` is already in `.env.local.example` — it just needs to be wired up.

**Files to change**:
1. `npm install @sentry/nextjs`
2. `sentry.client.config.ts` + `sentry.server.config.ts` — standard Next.js Sentry setup
3. `next.config.ts` — wrap with `withSentryConfig`
4. Add `SENTRY_DSN` to `.env.local.example` (already present as `NEXT_PUBLIC_SENTRY_DSN`, just confirm the variable name matches)

**Scope**: Capture unhandled exceptions in API routes and client pages. Do not add manual `Sentry.captureException` calls everywhere — let the default integration handle it.

**Acceptance criteria**: Deliberately throwing an error in an API route causes it to appear in the Sentry dashboard within 30 seconds.

---

### A5 · Affiliate link health checker (weekly Inngest cron)

**Why**: Card affiliate URLs go stale — banks change URLs, affiliate programs expire. A broken link = zero commission. Currently there is no automated check.

**New Inngest function**: `src/lib/inngest/functions/link-checker.ts`

**Logic**:
1. Schedule: weekly (every Monday)
2. Fetch all `cards` rows where `apply_url IS NOT NULL`
3. For each URL, `HEAD` request with a 5s timeout
4. If status >= 400 or timeout: insert a row into a new `link_health_log` table: `(card_id, url, status_code, checked_at, ok: false)`
5. If 5+ cards are broken, send an admin email via Resend: "Link health check: 5 broken affiliate URLs need attention"

**New migration**: `supabase/migrations/015_link_health_log.sql`
```sql
CREATE TABLE link_health_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID REFERENCES cards(id),
  url        TEXT,
  status_code INT,
  ok         BOOLEAN,
  checked_at TIMESTAMPTZ DEFAULT now()
);
```

**Admin API**: Add `GET /api/admin/link-health` that returns the last check's results grouped by `ok` status.

**Acceptance criteria**: Weekly Inngest run logs results to `link_health_log`. Admin can view broken links at `/admin` without touching the DB.

---

## Sprint 6 — India-First SEO (Acquisition)

> **PM note**: This is the primary acquisition strategy. The goal is to rank for Indian credit card and points queries where there is currently zero quality competition. All pages are generated from DB data — no manual content writing required.

### S1 · Programmatic card pages

**Why**: A dedicated, indexable page per card ("HDFC Infinia Credit Card — earn rates, point value, best redemptions") captures high-intent search traffic. We have all this data in the DB already.

**New route**: `src/app/[region]/cards/[slug]/page.tsx`

**Data to display** (all from DB):
- Card name, issuer, annual fee (with currency based on region)
- Earn rates (formatted as "X points per ₹100 spent" for India, "X points per $1" for US)
- Program it belongs to + current CPP valuation from `latest_valuations` view
- "Effective cashback rate" = earn rate × cpp (calculated, not stored)
- Apply Now button → affiliate click tracking endpoint (T8)
- Link to program page (S2)

**SEO requirements**:
- `generateMetadata` with title: `"{card name} Review — Earn Rates & Point Value | PointsMax"`
- Description: auto-generated from card data
- JSON-LD `FinancialProduct` schema
- `generateStaticParams` — pre-render all cards at build time from DB

**Index page**: `src/app/[region]/cards/page.tsx` — lists all cards for that region, links to individual pages.

**Acceptance criteria**: `/in/cards/hdfc-infinia` renders with correct data, passes `next build`, has valid JSON-LD.

---

### S2 · Programmatic program pages

**Why**: Loyalty program pages ("Air India Maharaja Club — current point value, transfer partners, best redemptions") target the research phase of the user journey.

**New route**: `src/app/[region]/programs/[slug]/page.tsx`

**Data to display**:
- Program name, type, current CPP from `latest_valuations`
- Cards that earn into this program (from DB)
- Transfer partners (if stored — add a `transfer_partners` JSONB column to `programs` if not present)
- "Best redemptions" — 3 bullet points (store as a `best_uses TEXT[]` column on `programs`)

**SEO requirements**: Same pattern as S1 — `generateMetadata`, JSON-LD `FinancialProduct`, `generateStaticParams`.

**Acceptance criteria**: `/in/programs/air-india-maharaja-club` renders correctly and is statically generated.

---

### S3 · Sitemap.xml — auto-generated from DB

**Why**: Without a sitemap, Google discovers pages slowly. With programmatic pages, a sitemap is critical for indexing at scale.

**New file**: `src/app/sitemap.ts` (Next.js built-in sitemap support)

**Logic**:
- Static routes: home, how-it-works, pricing, calculator, etc. for both regions
- Dynamic card pages: query all `cards` slugs from DB, generate `/us/cards/[slug]` and `/in/cards/[slug]`
- Dynamic program pages: same pattern for `programs`
- `changeFrequency`: cards = 'monthly', programs = 'monthly', static = 'yearly'
- `priority`: home = 1.0, programmatic pages = 0.8

**Acceptance criteria**: `GET /sitemap.xml` returns valid XML with all card and program URLs. Validates with Google's sitemap validator.

---

### S4 · JSON-LD structured data on all SEO pages

**Why**: Structured data enables rich results in Google (star ratings, prices, FAQs). `FinancialProduct` schema is directly applicable to credit cards.

**Scope**: Add to card pages (S1) and program pages (S2). Do not add to calculator/tool pages.

**Implementation**: Export a `generateJsonLd(card)` helper from `src/lib/seo.ts`. Include in the `<head>` via a `<script type="application/ld+json">` tag in each page's layout.

**Acceptance criteria**: Google's Rich Results Test tool validates the JSON-LD on `/in/cards/hdfc-infinia` without errors.

---

## Sprint 7 — Revenue Automation

> **PM note**: None of the revenue streams are live yet. This sprint makes money flow without any human action per transaction.

### R1 · PostHog analytics integration

**Why**: Cannot make product decisions without knowing where users drop off. PostHog free tier covers 1M events/month — more than sufficient for MVP. Must be in place before launch so we have data from day one.

**Install**: `npm install posthog-js`

**Files**:
1. `src/lib/posthog.ts` — initialize client (reads `NEXT_PUBLIC_POSTHOG_KEY`)
2. `src/app/layout.tsx` — wrap with `PostHogProvider`
3. Track these specific events (no more, no less):
   - `calculator_run` — when user hits Calculate
   - `advisor_opened` — when AI advisor tab is opened
   - `card_apply_clicked` — on affiliate click (in addition to DB log)
   - `award_search_run` — when award search fires
   - `upgrade_clicked` — when user clicks Stripe checkout
4. Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.local.example`

**Acceptance criteria**: The 5 events above appear in PostHog Live Events within 60 seconds of triggering them in the browser.

---

### R2 · Stripe checkout + webhook fully live

**Why**: Premium tier (live award availability + alerts) exists in code but no real payment can be made. Stripe keys are blocked on PM provisioning them, but the code must be ready.

**Files**: `src/lib/stripe.ts`, `src/app/api/stripe/route.ts` (check if route already exists and extend it)

**What to implement**:
1. `POST /api/stripe/create-checkout` — creates a Stripe Checkout session for `STRIPE_PRO_PRICE_ID`, redirects user to Stripe
2. `POST /api/stripe/webhook` — handles `checkout.session.completed`: update `users` table `is_premium = true` for the paying user
3. `GET /api/stripe/portal` — Stripe Customer Portal link for subscription management (cancel, update payment method)
4. On `customer.subscription.deleted` webhook event: set `is_premium = false`

**Test**: Include a Stripe test mode smoke test in `scripts/smoke-stripe-webhook.mjs` (already exists — verify it covers the above events).

**Acceptance criteria**: Full happy path works in Stripe test mode. `is_premium` flips correctly on payment and cancellation.

---

### R3 · Email onboarding drip (3 emails via Resend)

**Why**: Users who sign up and never return are wasted acquisition. A 3-email sequence re-engages them at the right moments.

**New Inngest function**: `src/lib/inngest/functions/onboarding-drip.ts`

**Trigger**: Fire when a new user signs up (hook into Supabase auth webhook or poll `users` table for `created_at` within last hour).

**Sequence**:
1. **Email 1 — Welcome** (immediately on signup): "Here's how PointsMax works in 2 minutes" — link to `/[region]/how-it-works`
2. **Email 2 — First value moment** (day 2, if user has not run calculator): "You have [X] cards — here's what your points are worth" — link to `/[region]/calculator`
3. **Email 3 — Retention** (day 7, if user has not returned): "Transfer bonus alert: [most recent bonus from DB]" — link to `/[region]/calculator`

**Skip logic**: If user has run the calculator (check `affiliate_clicks` or add a `last_active_at` column to `users`), skip Email 2. Always send Email 1.

**Acceptance criteria**: New test signup triggers all 3 emails at correct intervals in Resend dashboard (use test mode).

---

### R4 · Creator affiliate link system

**Why**: Partnering with Indian personal finance YouTubers is the fastest zero-cost acquisition channel. Each creator needs a unique tracking link so we know which creators convert.

**New migration**: `supabase/migrations/016_creator_links.sql`
```sql
CREATE TABLE creators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,   -- e.g. "sharan-hegde"
  platform    TEXT,                   -- "youtube", "instagram", "twitter"
  profile_url TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE affiliate_clicks ADD COLUMN creator_slug TEXT REFERENCES creators(slug);
```

**Middleware change**: In `middleware.ts`, read `?ref=sharan-hegde` query param and store `creator_slug` in a cookie (7-day expiry). All subsequent affiliate clicks in that session get the creator_slug attached.

**Admin endpoints**:
- `POST /api/admin/creators` — add a new creator
- `GET /api/admin/creators/[slug]/stats` — clicks, card applications, estimated revenue for that creator

**Acceptance criteria**: Visiting `/?ref=sharan-hegde` and then clicking "Apply Now" on any card records `creator_slug = "sharan-hegde"` in `affiliate_clicks`.

---

## Sprint 8 — Data Freshness (Keep Everything Accurate Automatically)

> **PM note**: Stale data kills trust. Every data point visible to users must have an automated update path. No human should need to update valuations, transfer bonuses, or card data manually.

### D1 · Transfer bonus monitor (Inngest cron)

**Why**: Transfer bonuses (e.g. "40% bonus transferring Chase UR to Avianca through Jan 31") are time-sensitive and high-value. Missing them makes the AI advisor less useful than a Reddit post.

**Source**: Doctor of Credit (`doctorofcredit.com/best-credit-card-sign-up-bonuses/`) and/or FlyerTalk transfer bonus threads. These are crawlable (no ToS restriction on reading public content).

**New Inngest function**: `src/lib/inngest/functions/transfer-bonus-monitor.ts`

**Schedule**: Daily at 7am UTC

**Logic**:
1. Fetch Doctor of Credit transfer bonus page
2. Parse with `cheerio` — extract (program, bonus %, expiry date) tuples
3. For each parsed bonus: check if it already exists in `transfer_bonuses` table (match on program + expiry)
4. If new: insert row + send admin email "New transfer bonus detected: [details] — verify and publish"
5. For expired bonuses (expiry_date < today): set `active = false` automatically

**New DB column**: `transfer_bonuses` table needs `source_url TEXT`, `auto_detected BOOLEAN DEFAULT false`, `verified BOOLEAN DEFAULT false`. Admin must verify auto-detected bonuses before they go live to users (`WHERE verified = true` in public queries).

**Acceptance criteria**: New transfer bonus on Doctor of Credit appears in admin inbox within 24 hours. Expired bonuses are deactivated automatically.

---

### D2 · Admin quick-entry UI for transfer bonuses

**Why**: D1 auto-detects but requires human verification. The admin UI must make that verification take under 60 seconds.

**File**: `src/app/admin/` — add a "Transfer Bonuses" section

**What to build**:
- List view: shows auto-detected unverified bonuses at the top (highlighted), verified/active bonuses below
- Each unverified row has: [Verify & Publish] and [Reject] buttons
- [Verify & Publish] sets `verified = true`, `active = true`
- Add manual entry form: program (dropdown from `programs` table), bonus %, expiry date, notes
- No direct DB access ever needed

**Acceptance criteria**: Admin can verify a new auto-detected bonus in under 3 clicks. No Supabase dashboard required.

---

## Sprint 9 — Growth Loops

> **PM note**: After launch, growth comes from users sharing. Build the mechanics for organic sharing before running any campaigns.

### G1 · Shareable trip/result URLs

**Why**: "I optimized my trip to Tokyo for ₹0 using PointsMax" is a powerful share moment. Users need a URL to share, not a screenshot.

**New migration**: `supabase/migrations/017_shared_trips.sql`
```sql
CREATE TABLE shared_trips (
  id          TEXT PRIMARY KEY,  -- short nanoid, e.g. "abc123"
  region      TEXT NOT NULL,
  trip_data   JSONB NOT NULL,    -- snapshot of calculator result
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**New API**: `POST /api/trips/share` — takes current calculator state, stores it, returns `{ url: "/us/trips/abc123" }`

**New page**: `src/app/[region]/trips/[id]/page.tsx` — read-only view of the shared trip. No login required. Shows: destination, points used, programs, estimated value saved.

**Share button**: Add "Share this trip" button to the calculator results panel. Copies URL to clipboard. Fires `trip_shared` PostHog event.

**Acceptance criteria**: Sharing a trip generates a public URL. Visiting that URL shows the correct trip without logging in.

---

### G2 · Social proof counter on landing page

**Why**: "Join X travelers who have optimized Y points" builds trust at zero cost and updates automatically.

**Implementation**:
- New DB view: `CREATE VIEW site_stats AS SELECT COUNT(*) as user_count, SUM(...)...`
- New API: `GET /api/stats` — returns `{ users: N, pointsOptimized: N }` (cached in Upstash Redis for 1 hour)
- Landing page (`/[region]/page.tsx`) — add a stats bar: "4,200 travelers · ₹38 crore in points optimized"
- Numbers update automatically as the view recalculates

**Acceptance criteria**: Landing page shows real numbers from DB. Refreshing after new signups shows updated count within 1 hour.

---

### G3 · India landing page — differentiated positioning

**Why**: The `/in` landing page currently shows the same content as `/us`. India users need to see India-specific value props, Indian card names, INR amounts, and social proof relevant to them.

**File**: `src/app/[region]/page.tsx` — add region-conditional rendering for hero copy, featured cards, and testimonials section

**India-specific changes**:
- Hero headline: "India's first AI-powered credit card optimizer" (if region === 'in')
- Featured cards: HDFC Infinia, Axis Atlas, Amex Platinum India (not Chase/Amex US)
- Value prop example: "Fly Mumbai → London in Business Class for ₹0" instead of US example
- CTA: "Optimize your HDFC/Axis/Amex points →"

**Acceptance criteria**: `/in` and `/us` landing pages have visibly different hero content, featured cards, and value proposition examples.

---

## Sprint 10 — Performance & Speed (Fix the Biggest UX Problem)

> **PM note**: Speed IS the product. Every 100ms of latency costs conversion. The audit identified 3 concrete bottlenecks that must be fixed before launch. These are engineering tasks, not design tasks.

### P1 · Fix Supabase connection pooling for serverless

**Why**: Every serverless function invocation currently creates a new database connection from scratch. In Vercel's serverless environment, this means cold connection overhead on every API request (50–200ms per request). Supabase provides a pgBouncer pooled connection URL that reuses connections.

**What to change**: In `src/lib/supabase.ts` and `src/lib/supabase-server.ts`, the DB client should use the pooled connection URL for all non-realtime queries.

1. Add `SUPABASE_DB_URL_POOLED` to `.env.local.example` (this is the `?pgbouncer=true&connection_limit=1` URL from Supabase project settings → Database → Connection string → URI → Session mode pooler)
2. In `createServerDbClient()`: use `SUPABASE_DB_URL_POOLED` instead of the direct connection URL for all standard query clients
3. Keep the direct connection (non-pooled) only for migrations and admin operations that require DDL

**Acceptance criteria**: API response times for `/api/calculate` and `/api/cards` drop by at least 100ms on cold starts measured with `curl -w "%{time_total}"`.

---

### P2 · Award search — return results immediately, stream narrative async

**Why**: The award search currently does: (1) fetch availability, (2) generate AI narrative, (3) return everything together. Step 2 takes 1–3 seconds. Users are blocked waiting for AI prose they may not even read, when the actual flight data is already ready.

**File**: `src/app/api/award-search/route.ts`

**Change**:
1. Return flight results immediately in the response (don't await narrative)
2. Add a separate `GET /api/award-search/narrative?params=...` endpoint that generates just the narrative
3. On the frontend (`src/app/[region]/award-search/page.tsx`): render results immediately, then fetch narrative in a second `useEffect` call that populates a "summary" section after results appear

**Acceptance criteria**: Flight results appear within 1 second of submitting search. AI narrative appears 1–3 seconds later without blocking the results. User sees results, not a spinner, first.

---

### P3 · Add `loading.tsx` skeleton files for all main routes

**Why**: Next.js App Router supports `loading.tsx` files that show immediately while the page's data is loading. Without these, users see a blank/frozen screen during navigation. This is the single highest-impact perceived-performance improvement.

**Create these files** (each should be a skeleton that matches the page layout):

- `src/app/[region]/calculator/loading.tsx` — skeleton with 3 input fields + results panel outline
- `src/app/[region]/award-search/loading.tsx` — skeleton with search form + 3 result card outlines
- `src/app/[region]/card-recommender/loading.tsx` — skeleton with filter sidebar + 4 card outlines
- `src/app/[region]/earning-calculator/loading.tsx` — skeleton with table rows
- `src/app/[region]/cards/loading.tsx` — skeleton grid of card tiles
- `src/app/[region]/programs/loading.tsx` — skeleton list of program rows

**Implementation**: Each `loading.tsx` should use `animate-pulse` on `div` placeholders that mirror the real layout. Use Tailwind only — no additional dependencies.

**Acceptance criteria**: Navigating between pages shows skeleton immediately (0ms delay) instead of blank screen. Verify with Chrome DevTools → Network → Slow 3G throttling.

---

### P4 · ISR (Incremental Static Regeneration) for programmatic SEO pages

**Why**: Card and program pages (S1, S2) query the database on every request. These pages change at most once a month (when valuations update). Caching them at the CDN edge eliminates the DB round-trip entirely for the vast majority of requests.

**Files**: `src/app/[region]/cards/[slug]/page.tsx` and `src/app/[region]/programs/[slug]/page.tsx`

**Change**: Add `export const revalidate = 3600` (1 hour) at the top of both page files. This tells Next.js to cache the page at Vercel's edge and regenerate it in the background every hour.

**Also add** to `next.config.ts`:
```typescript
// Ensure ISR pages get fresh data after valuations update
// The update-valuations cron should call revalidatePath after updating
```

In `src/app/api/cron/update-valuations/route.ts`, after updating valuations: call `revalidateTag('valuations')` and tag card/program pages with this tag so they invalidate when valuations change.

**Acceptance criteria**: Card pages load from CDN cache (verify via `x-vercel-cache: HIT` response header). After running the valuations cron, pages show updated CPP within 60 seconds.

---

## Sprint 11 — World-Class UI Polish

> **PM note**: The gap between "functional" and "professional" is mostly: consistent components, motion, and loading states. Top companies (Linear, Vercel, Stripe) all use shadcn/ui + Framer Motion + Geist font. Adopt this stack — it's compatible with existing Tailwind classes.

### U1 · Install shadcn/ui and replace ad-hoc form components

**Why**: The current `pm-button`, `pm-input`, `pm-card` classes are custom CSS in globals.css. shadcn/ui provides accessible, animated, consistent versions of the same components built on Radix UI primitives. This eliminates accessibility bugs (focus rings, ARIA, keyboard navigation) and makes the UI feel polished.

**Install**:
```bash
npx shadcn@latest init
# Choose: TypeScript, Tailwind, src/ directory, app router
npx shadcn@latest add button input card badge tabs dialog toast select label
```

**What to replace** (do NOT touch custom calculator logic, just UI components):
- All `<button className="pm-button...">` → `<Button>` from shadcn
- All `<input className="pm-input...">` → `<Input>` from shadcn
- All card containers with `pm-card` → `<Card>` from shadcn
- Program/card selection dropdowns → `<Select>` from shadcn
- Modal dialogs → `<Dialog>` from shadcn
- Toast notifications → shadcn `toast` (replace any existing toast implementation)
- Tab switchers (calculator tabs, region tabs) → `<Tabs>` from shadcn

**Keep** the existing Tailwind color tokens (`pm-shell` for max-width, custom teal color) — shadcn works alongside these.

**Acceptance criteria**: `npm run build` passes. All interactive elements have visible focus rings. No custom `pm-button`/`pm-input` CSS remaining in globals.css.

---

### U2 · Add Framer Motion — page transitions + micro-interactions

**Why**: The difference between a "vibecoded" site and a professional one is motion. Subtle animations signal quality. Framer Motion is the standard for Next.js apps.

**Install**: `npm install framer-motion`

**Apply to these specific places** (do not animate everything — restraint is the mark of good design):

1. **Page transitions** — wrap page content in `<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>` in a shared layout
2. **Calculator results** — animate result cards into view with stagger: each card delays by `0.05s * index`
3. **Award search results** — same stagger pattern as calculator results
4. **Card recommender cards** — stagger on initial load
5. **Number counters** — on the landing page stats (G2), animate numbers counting up from 0 on first viewport entry
6. **Modal/dialog open** — already handled by shadcn/Radix, but verify smooth animation

**Do NOT animate**: NavBar, Footer, form inputs, buttons (shadcn handles hover states via CSS)

**Acceptance criteria**: Results panels animate in smoothly. No layout shift. `prefers-reduced-motion` media query is respected (Framer Motion handles this automatically via `useReducedMotion`).

---

### U3 · Dark mode with Tailwind

**Why**: ~50% of users have OS-level dark mode enabled. A site that ignores this feels unfinished. Tailwind's `dark:` variant makes this a CSS-only change once the toggle mechanism is in place.

**Implementation**:
1. In `tailwind.config.ts`: set `darkMode: 'class'` (class-based, not media query — gives user control)
2. In `src/app/layout.tsx`: add `ThemeProvider` from `next-themes` (`npm install next-themes`)
3. In `NavBar.tsx`: add a sun/moon toggle button using Lucide icons (`SunIcon`, `MoonIcon`)
4. Audit all existing Tailwind classes and add `dark:` counterparts for:
   - Background colors: `bg-white` → `bg-white dark:bg-gray-900`
   - Text colors: `text-gray-900` → `text-gray-900 dark:text-gray-100`
   - Border colors: `border-gray-200` → `border-gray-200 dark:border-gray-700`
   - Card backgrounds: `bg-gray-50` → `bg-gray-50 dark:bg-gray-800`
5. shadcn/ui components (from U1) have dark mode built in — they just need the class toggle

**Acceptance criteria**: Toggling dark mode switches all pages smoothly. No white flash on page load. Preference is persisted in localStorage.

---

### U4 · Geist font + tightened typography scale

**Why**: Inter is good, but Geist (Vercel's open-source font) is now the standard for premium developer/fintech tools. More importantly, the current type scale is likely inconsistent — headings, body text, and captions need a clear hierarchy.

**Install**:
```bash
npm install geist
```

**Files**:
1. `src/app/layout.tsx`: replace `Inter` import with `GeistSans` and `GeistMono` from `geist/font`
2. `tailwind.config.ts`: add `fontFamily: { sans: ['var(--font-geist-sans)'], mono: ['var(--font-geist-mono)'] }`
3. Define a strict type scale in `tailwind.config.ts` theme extension:
   - `text-display`: 3rem/1.1 (hero headlines)
   - `text-title`: 1.5rem/1.3 (page titles)
   - `text-heading`: 1.125rem/1.4 (section headings)
   - `text-body`: 1rem/1.6 (body text)
   - `text-caption`: 0.875rem/1.5 (labels, helper text)

**Audit**: Replace all raw `text-2xl font-bold` style combinations with the defined scale classes. Consistency here is what separates "designed" from "built."

**Acceptance criteria**: Geist font loads correctly. All pages use the defined type scale. No mixing of `text-xl font-semibold` and `text-2xl font-bold` for the same semantic level.

---

### U5 · Comprehensive empty states and error states

**Why**: Empty states are a conversion opportunity. Error states are a trust signal. Both are currently under-designed.

**Empty states to add/improve**:
- **Calculator — no balances yet**: "Add your points balances above to see what your points are worth" with an arrow pointing up
- **Award search — no results**: "No award availability found. Try flexible dates or nearby airports." with a date-range suggestion
- **Card recommender — no cards match filters**: "No cards match your filters. Try broadening your spend categories."
- **Profile — no alerts set**: "You're not watching any programs yet. Set an alert to get notified of transfer bonuses."

**Error states to improve**:
- All API errors should show a human message + a "Try again" button that retries the last action
- Network errors should distinguish between "no internet" and "server error"
- AI errors should show "Our AI is taking a break. Here are your raw results." (fallback to non-AI output)

**Acceptance criteria**: Every list/results area has a designed empty state. Every API call has a designed error state. No raw `error.message` strings shown to users.

---

## Sprint 12 — Profile, Security & Compliance

> **PM note**: A world-class product handles account management, data rights, and security properly. These are not optional — they're table stakes for any site handling user accounts and financial data.

### C1 · Account deletion (GDPR/data rights)

**Why**: Any site with user accounts in the EU or India (PDPB) must allow users to delete their data. This is also a trust signal — users sign up more freely when they know they can leave.

**What to build**:
1. `DELETE /api/user/account` — authenticated, deletes all user data:
   - `user_preferences` — delete
   - `alert_subscriptions` — delete
   - `affiliate_clicks` (user_id column) — anonymize (set to NULL, don't delete rows — affiliate reporting integrity)
   - `shared_trips` — delete
   - `users` row — delete last
   - Supabase auth account — call `supabase.auth.admin.deleteUser(userId)`
2. Profile page: add "Delete Account" button at the bottom, behind a confirmation dialog
3. Confirmation dialog: "This cannot be undone. Type DELETE to confirm." — use shadcn `<AlertDialog>`

**Acceptance criteria**: User can delete their account entirely from the profile page. All their data is gone from the DB. They are logged out and redirected to home.

---

### C2 · Billing management in profile

**Why**: Users who upgrade to Pro have no way to manage or cancel their subscription from within the app. They'd have to email support. This is a bad experience and increases churn.

**The Stripe Customer Portal already exists** at `/api/stripe/portal` — it just needs to be surfaced in the UI.

**File**: `src/app/profile/page.tsx`

**What to add**:
- If `user.is_premium === true`: show a "Manage Subscription" button that redirects to Stripe portal
- Show current plan status: "Pro — renews [date]" or "Free"
- If `user.is_premium === false`: show "Upgrade to Pro" button → Stripe checkout

**Acceptance criteria**: Pro user can access Stripe billing portal from their profile page in 1 click. Free user sees a clear upgrade prompt.

---

### C3 · Admin audit log

**Why**: Currently there is no record of what admin actions were taken (who changed a valuation, who verified a transfer bonus, who deleted a user). For a financial data product this is a liability.

**New migration**: `supabase/migrations/018_admin_audit_log.sql`
```sql
CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action      TEXT NOT NULL,   -- e.g. "valuation.update", "bonus.verify", "user.delete"
  target_id   TEXT,            -- ID of the affected record
  payload     JSONB,           -- before/after values
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Implementation**: Add a `logAdminAction(action, targetId, payload)` helper to `src/lib/admin-auth.ts`. Call it in every admin POST/PATCH/DELETE route handler.

**Admin UI**: Add an "Audit Log" tab to the admin dashboard showing the last 100 actions.

**Acceptance criteria**: Every admin write operation (valuation update, bonus verify/reject, user delete) creates an audit log entry. Visible in admin dashboard.

---

### C4 · Rate limiting on admin routes

**Why**: Admin routes (`/api/admin/*`) currently have no rate limiting. An attacker who obtains admin credentials can hammer these routes freely.

**File**: `src/lib/api-security.ts` (rate limiting already implemented for public routes)

**Change**: Apply rate limiting to all admin routes — 20 requests per minute per IP. Use the existing `rateLimit()` utility already in the codebase.

**Acceptance criteria**: More than 20 requests per minute to any `/api/admin/*` route from a single IP returns 429. Verified with a quick `ab` or `curl` loop test.

---

## Sprint 13 — India Data Integrity (Correctness Bugs — Fix Before Any Marketing)

> **PM note**: These are not polish issues — they are correctness bugs that make the India product actively wrong. A user seeing Chase UR on the India site or a point value of ₹0.01 will immediately lose trust. Fix these before any user acquisition effort.

### F1 · Fix dark mode — replace hardcoded colors with semantic CSS variables

**Why**: Dark mode is broken because components use hardcoded Tailwind arbitrary values (`bg-[#f3faf6]`, `text-[#1b4438]`) instead of the CSS variables defined in `globals.css`. The CSS variables for dark mode are already defined and correct — they just aren't being used.

**Root cause** (confirmed by audit):
- `globals.css` defines proper `--pm-surface`, `--pm-text`, `--pm-border` etc. for both light (`:root`) and dark (`.dark`) modes
- But components reference colors directly: `bg-[#f3faf6]` instead of `bg-pm-surface`
- Tailwind's `dark:` variants never fire because the CSS variables aren't wired into class names

**Step 1 — Wire CSS variables into Tailwind config** (`tailwind.config.ts`):
Add to the `theme.extend.colors` block:
```typescript
colors: {
  'pm-bg':         'var(--pm-bg)',
  'pm-surface':    'var(--pm-surface)',
  'pm-border':     'var(--pm-border)',
  'pm-text':       'var(--pm-text)',
  'pm-text-muted': 'var(--pm-text-muted)',
  'pm-primary':    'var(--pm-primary)',
  'pm-primary-fg': 'var(--pm-primary-fg)',
  'pm-error':      'var(--pm-error)',
  'pm-success':    'var(--pm-success)',
}
```

**Step 2 — Audit and replace hardcoded colors in these files** (highest impact, do in this order):
1. `src/components/NavBar.tsx` — replace all `bg-[#...]`, `text-[#...]` with `bg-pm-surface`, `text-pm-text` etc.
2. `src/components/Footer.tsx` — same
3. `src/app/[region]/page.tsx` (landing page) — replace hero section hardcoded colors
4. `src/app/[region]/calculator/page.tsx` — this is the most extensive; replace all result card colors
5. `src/app/[region]/how-it-works/page.tsx`
6. `src/app/[region]/pricing/page.tsx`

**Do NOT change**: shadcn/ui components in `src/components/ui/` — these already use CSS variables correctly via their own design tokens.

**Step 3 — Verify `globals.css`** has complete dark mode variable coverage. Every variable defined in `:root` must have a counterpart in `.dark { }`.

**Acceptance criteria**: Toggle dark mode → every page switches cleanly. No white cards on dark background, no dark text on dark background. Test on: landing, calculator, how-it-works, pricing, profile. No hardcoded `bg-[#...]` or `text-[#...]` classes remain in the 6 files listed above.

---

### F2 · Fix Indian point valuations — correct values + INR-aware scraper

**Why**: The current India valuations are wrong in two ways: (1) the seeded values are arbitrary guesses, and (2) the TPG scraper (T3) only covers US programs. Indian users see wildly incorrect point values, which destroys trust immediately.

**Current state** (confirmed by audit):
- Migration 011 stores Indian valuations in paise (subunits of INR): HDFC = 120 paise (₹1.20/pt), Axis = 115 paise, etc.
- The calculator displays these correctly as ₹ amounts (divides by 100)
- BUT: the values are wrong — HDFC Infinia points at ₹1.20 is too high for a generic card reward program. Real values vary by redemption type.
- TPG scraper (T3) runs monthly and overwrites programs by slug — it will try to scrape Indian programs from TPG and find nothing, potentially zeroing out Indian valuations.

**Correct seed values to update via migration** (`supabase/migrations/021_india_valuations_fix.sql`):

Valuations are in **paise** (multiply INR by 100 to get paise):

| Program slug | CPP (paise) | Rationale |
|---|---|---|
| hdfc-millennia | 50 | ₹0.50/pt — conservative blended (statement credit ~₹0.33, airline transfer ~₹1.50) |
| axis-edge | 50 | ₹0.50/pt — similar to HDFC structure |
| amex-india-mr | 75 | ₹0.75/pt — Amex India has better airline partners than domestic programs |
| air-india | 100 | ₹1.00/mile — Air India business class awards average ~₹1–1.5/mile |
| indigo-6e | 30 | ₹0.30/pt — very limited redemption options, low value |
| taj-innercircle | 80 | ₹0.80/pt — Taj hotel redemptions average ~₹0.70–0.90/pt |

**Update TPG scraper to skip India programs** (`src/app/api/cron/update-valuations/route.ts`):
- After fetching TPG data, before upserting: check if `program.geography === 'IN'` — skip those programs entirely
- Add a log entry: `skipped_india_programs: N` in the response

**New Inngest function** — Indian valuations scraper (`src/lib/inngest/functions/india-valuations-scraper.ts`):

Schedule: monthly (1st of month at 11am UTC, same day as TPG scraper)

Logic:
1. Fetch these specific pages (they contain editorial point valuations):
   - `https://www.cardexpert.in/best-credit-cards/` (card comparison table with reward rates)
   - `https://technofino.in/credit-card-reward-points-value/` (if this page exists, else search for "reward points value" on the site)
2. Pass the HTML content to Gemini with this prompt:
   ```
   Extract credit card reward point valuations from this page.
   Return a JSON array of: { program_name: string, cpp_inr: number, source_quote: string }
   where cpp_inr is rupees per point (e.g. 1.50 means ₹1.50 per point).
   Only include entries where a numeric value is clearly stated or calculable.
   ```
3. Map extracted program names to our slugs using a mapping object (same pattern as TPG scraper)
4. Convert cpp_inr to paise (multiply by 100) before storing
5. Insert into `valuations` with `source = 'india-scraper'`, `auto_detected = true`, `verified = false`
6. Send admin email if new valuations differ by more than 20% from current values

**Acceptance criteria**: Indian program pages show correct ₹ valuations (not USD, not wildly incorrect paise). Admin receives monthly update with any significant valuation changes. TPG scraper no longer touches Indian programs.

---

### F3 · Fix "How it works" page — full regional revamp

**Why**: The current page lists hardcoded US programs (Chase, Amex, United, Delta, etc.) regardless of region. An Indian user sees this and immediately knows the product isn't for them. This page is also a conversion opportunity — it should show the AHA moment that converts skeptics.

**File**: `src/app/[region]/how-it-works/page.tsx`

**The AHA moment to engineer**: Users don't know their points are worth far more than face value. Show them the math concretely.

**New page structure** (region-conditional throughout):

**Hero section**:
- India: "Your HDFC Infinia points are worth ₹1 each — not 0.3 paise"
- US: "Your Chase points are worth 2¢ each — not 1¢ in cash"

**The math section** (most important — this is what converts):
- India example:
  ```
  50,000 HDFC Infinia points
  ├── Statement credit:     ₹16,500  (₹0.33/pt)
  ├── Amazon voucher:       ₹25,000  (₹0.50/pt)
  └── Air India business:  ₹75,000+ (₹1.50+/pt) ← PointsMax shows you this
  ```
- US example:
  ```
  100,000 Chase Ultimate Rewards
  ├── Cash back:            $1,000   (1¢/pt)
  ├── Chase travel portal:  $1,500   (1.5¢/pt)
  └── Lufthansa Business:  $4,200+  (4.2¢/pt) ← PointsMax shows you this
  ```

**How it works steps** (3 steps, region-specific copy):
- India step 1: "Add your HDFC, Axis, and Amex India balances"
- India step 2: "Tell us your travel goal (Mumbai → Dubai, Delhi → London)"
- India step 3: "Get the best redemption path + transfer timing"

**Programs supported section** (pull from DB by region — not hardcoded):
- India: HDFC Millennia, Axis EDGE, Amex India MR, Air India Maharaja Club, IndiGo 6E, Taj InnerCircle
- US: Chase UR, Amex MR, Capital One, Citi TYP, Bilt, United, Delta, AA, Southwest, Hyatt, Hilton, Marriott

**Implementation**: Query `/api/programs?region=IN` (or US) at page load, render the program list dynamically. Remove ALL hardcoded program references.

**FAQ section** (region-conditional):
- India: "How are Indian card points valued?", "Can I transfer HDFC points to Air India?", "Is this different from CardExpert or Technofino?"
- US: "How are points valued?", "What transfer partners are supported?", "Is this different from TPG?"

**CTA**: "Calculate my [HDFC/Chase] points value →" linking to `/${region}/calculator`

**Acceptance criteria**: `/in/how-it-works` shows only India programs, India-specific math example, INR amounts, and India FAQ. `/us/how-it-works` shows only US content. No hardcoded program lists in the file.

---

### F4 · Audit and fix all hardcoded USD across the India experience

**Why**: Despite the calculator using `config.currencySymbol`, there are likely places where `$` is hardcoded or where USD assumptions leak through.

**Files to audit** (search for `$`, `USD`, `cents`, `cpp` display strings):
1. `src/app/[region]/pricing/page.tsx` — pricing must show $ for US, ₹ for India
2. `src/app/[region]/cards/[slug]/page.tsx` — card review pages
3. `src/app/[region]/programs/[slug]/page.tsx` — program pages
4. `src/app/[region]/card-recommender/page.tsx`
5. `src/app/[region]/earning-calculator/page.tsx`
6. `src/app/api/stats/route.ts` — the social proof counter converts to USD; India should show INR crore

**Specific fixes**:
- Pricing page: wrap price display in region-aware component. India Pro plan price must show ₹ (set a `STRIPE_PRO_PRICE_INR` env var for the India plan — can be same product, different price object in Stripe)
- Stats API: add `currency` field to response — India clients receive `{ users: N, value_inr: N, value_usd: N }`, landing page uses the right one
- Program CPP display: `1.5¢ per point` on US → `₹1.50 per point` on India. Format using `region.currencySymbol` + `region.currency` everywhere

**Acceptance criteria**: Visit every page at `/in/*` — no `$` or `USD` appears anywhere except in context that explicitly references US (e.g., "transfers to US airlines"). Visit `/us/*` — no `₹` or `INR` appears.

---

## Sprint 14 — Content & Positioning (Make Pages Earn Their Keep)

> **PM note**: Every page is either a conversion tool or a liability. Right now most content pages are liabilities — they exist but don't convert. Each page should have one job and do it well.

### X1 · Landing page hero — A/B test copy variants

**Why**: The current hero is functional but not differentiated. "India's first AI-powered credit card optimizer" is a claim; we need to support it with proof in the hero itself.

**File**: `src/app/[region]/page.tsx`

**India hero change**:
- Current: generic headline + generic CTA
- New: Lead with the value gap. Show the number.
  - Headline: "Most HDFC Infinia holders redeem points at ₹0.33 each. You can get ₹1.50."
  - Subhead: "PointsMax finds the redemption path that multiplies your points — before you transfer."
  - CTA: "Calculate my points value" (no login required)
  - Trust signal below CTA: "No credit card needed · Your data stays private"

**US hero change**:
- Headline: "Stop leaving 3× value on the table."
- Subhead: "PointsMax shows you the exact redemption that maximizes your Chase, Amex, and Citi points — before you commit."

**Acceptance criteria**: Updated copy live at `/in` and `/us`. CTA links directly to calculator (no login wall).

---

### X2 · Add a "Quick value check" widget to landing page (no signup required)

**Why**: The biggest conversion barrier is asking users to sign up before they see value. A landing page widget that calculates point value in 10 seconds (no account required) is the highest-leverage conversion improvement possible.

**Implementation**:
- Add a compact widget directly on the landing page (below the hero, above the "How it works" steps)
- Widget: 3 dropdowns + 1 number input:
  - "I have" [program dropdown — India or US depending on region]
  - [number input] points
  - "→ Best value: [calculated]" (updates in real time as user types)
- No API call needed — embed the CPP values directly in the page (fetched at SSR time from `/api/programs?region=X`)
- Calculation: `points × cpp_value = best_value_display`
- Below the result: "See full breakdown →" → links to calculator

**Acceptance criteria**: Widget works without login. As user types point balance, estimated value updates in <100ms. CTA to full calculator is prominent below the result.

---

## Sprint 15 — Engineering Quality (Kimi's Codebase Audit)

> **PM note**: These are real bugs and quality issues surfaced in a codebase audit. Items 3, 9, 10 from the audit were rejected: sameSite 'lax' is correct for affiliate tracking (strict would break cross-site cookie delivery), and the unused import / type assertion issues are too small for a sprint slot. The 8 tasks below are all valid and assigned to Kimi.

### Q1 · Fix AI recommend route — hardcoded USD assumptions in India context

**Why**: The `/api/recommend` route constructs an AI prompt that hardcodes USD units (e.g. "worth X cents per point", "best value in dollars"). India users receive advice in USD terms even when their program is HDFC or Axis. This is a correctness bug, not just a display issue — the AI's reasoning is anchored to the wrong currency.

**File**: `src/app/api/recommend/route.ts` (or wherever the recommendation prompt is built)

**What to fix**:
1. Read `region` from the request (already available via params or header)
2. Construct prompt with region-aware language:
   - India: "worth X paise per point", "best value in rupees (₹)"
   - US: "worth X cents per point", "best value in dollars ($)"
3. Pass `currencySymbol`, `currencyCode`, and `cpp_unit` from `REGIONS[region]` into the prompt template — do not hardcode either

**Acceptance criteria**: AI recommendation response for `/in` region uses ₹ and rupee units throughout. No "cents" or "$" in the response for Indian users. Verify with a test prompt using HDFC Millennia program.

---

### Q2 · Rate limit `/api/programs` (and other unprotected public API routes)

**Why**: `/api/programs` is the most-called public API route (used by the calculator, landing widget, and SEO pages). It has no rate limiting. A single script can make thousands of requests per second, exhausting DB connections and taking the site down.

**File**: `src/lib/api-security.ts` (rate limiting already implemented; apply it here)

**Routes to protect** (apply `rateLimit()` call at the top of each handler):
- `src/app/api/programs/route.ts` — 60 requests/min/IP
- `src/app/api/cards/route.ts` — 60 requests/min/IP
- `src/app/api/calculate/route.ts` — 20 requests/min/IP (computationally heavier)
- `src/app/api/award-search/route.ts` — 10 requests/min/IP (external API calls behind it)

**Pattern**: The existing Upstash-based `rateLimit()` call returns `{ success: boolean, limit, remaining, reset }`. If `!success`, return `Response.json({ error: 'rate_limit_exceeded' }, { status: 429, headers: { 'Retry-After': reset } })`.

**Acceptance criteria**: More than 60 requests/minute to `/api/programs` from a single IP returns 429 with `Retry-After` header. Normal usage is unaffected.

---

### Q3 · Standardize API error response format across all routes

**Why**: Different routes return errors in different shapes:
- Some: `{ error: "message" }`
- Some: `{ message: "error" }`
- Some: `{ ok: false, error: { code: "X", message: "Y" } }`
- Some: plain status code with empty body

The frontend has to handle all these shapes with special cases, making error handling fragile. When a new error surfaces, it's silently swallowed because the frontend checks the wrong field.

**Define a standard** in `src/lib/api-error.ts` (new file):
```typescript
export interface ApiError {
  error: {
    code: string;      // machine-readable: "rate_limit_exceeded", "invalid_program_id", etc.
    message: string;   // human-readable
  };
}

export function apiError(code: string, message: string, status = 400): Response {
  return Response.json({ error: { code, message } } satisfies ApiError, { status });
}
```

**Migrate these routes** (highest-traffic first):
1. `src/app/api/calculate/route.ts`
2. `src/app/api/programs/route.ts`
3. `src/app/api/recommend/route.ts`
4. `src/app/api/award-search/route.ts`
5. `src/app/api/analytics/affiliate-click/route.ts`

**Update frontend error handling** in the calculator and award search pages to read `error.error.code` and `error.error.message`.

**Acceptance criteria**: All 5 routes return `{ error: { code, message } }` for all error cases. TypeScript enforces the shape via `satisfies ApiError`. No route returns a bare `{ message: "..." }` error.

---

### Q4 · Replace `console.error` with Sentry-aware structured logging

**Why**: There are ~15 `console.error(...)` calls scattered across API routes and lib files. In production (Vercel), these appear in raw logs that require manual log tailing to find. Sentry captures unhandled exceptions automatically, but `console.error` calls in catch blocks are not unhandled — they're explicitly swallowed. This means real errors are silently lost.

**What to do**:
1. Create `src/lib/logger.ts`:
```typescript
import * as Sentry from '@sentry/nextjs';

export const logger = {
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    console.error(message, error);
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { message, ...context } });
    } else {
      Sentry.captureMessage(message, { level: 'error', extra: context });
    }
  },
  warn(message: string, context?: Record<string, unknown>) {
    console.warn(message, context);
    Sentry.captureMessage(message, { level: 'warning', extra: context });
  },
};
```

2. Search for all `console.error(` occurrences across `src/` — replace each with `logger.error(message, error, { context })` where context includes relevant IDs (user_id, program_id, etc.)

3. Do NOT replace `console.log` or `console.warn` — only `console.error` in catch blocks and error paths

**Acceptance criteria**: Zero `console.error` calls in `src/` (verified with `grep -r "console.error" src/`). Each replaced call includes meaningful context. Errors flow to Sentry dashboard.

---

### Q5 · Sanitize JSON-LD data before `dangerouslySetInnerHTML`

**Why**: JSON-LD structured data is injected into the page via `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />`. If the `json` string contains a program name or description fetched from DB that includes `</script>`, it breaks out of the script tag and creates an XSS vector.

**File**: `src/lib/seo.ts` (the `generateJsonLd` helper)

**Fix**:
```typescript
function sanitizeForJsonLd(str: string): string {
  // Escape </script> sequences to prevent early tag termination
  return str.replace(/<\/script>/gi, '<\\/script>').replace(/<!--/g, '<\\!--');
}

export function generateJsonLd(data: object): string {
  return JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>').replace(/<!--/g, '<\\!--');
}
```

**Apply this** everywhere `dangerouslySetInnerHTML` is used with JSON-LD — search for `dangerouslySetInnerHTML` in the codebase and ensure every instance goes through `generateJsonLd()` rather than raw `JSON.stringify()`.

**Acceptance criteria**: A program name containing `</script>alert(1)</script>` in the DB does not trigger an alert when the card page is rendered. Verified by temporarily adding such a name to a test program and checking the rendered HTML is escaped.

---

### Q6 · Add client-side program ID validation in calculator

**Why**: The calculator's program selection dropdowns currently trust that the selected `program_id` is valid. If a user manually edits the DOM or sends a crafted request, an invalid UUID can reach the API. The API should already validate server-side, but client-side validation prevents unnecessary API round-trips and catches bugs earlier.

**File**: `src/app/[region]/calculator/page.tsx`

**What to add**:
1. When program IDs are loaded from `/api/programs`, store them in a `Set<string>` for O(1) lookup
2. Before calling `/api/calculate`, validate each selected `program_id` is in the set:
```typescript
const validProgramIds = new Set(programs.map(p => p.id));
const invalidIds = selectedProgramIds.filter(id => !validProgramIds.has(id));
if (invalidIds.length > 0) {
  setCalculatorError('Invalid program selection. Please refresh and try again.');
  return;
}
```
3. Show the error inline (not an alert) and do not fire the API call

**Acceptance criteria**: Manually setting an invalid program_id in React DevTools and clicking Calculate shows a validation error without hitting the API (verify with Network tab — no request fired).

---

### Q7 · Add retry logic for affiliate click DB writes

**Why**: The affiliate click tracking in `/api/analytics/affiliate-click/route.ts` does a single DB insert with no retry. If the insert fails (transient Supabase connection error, brief DB hiccup), the click is permanently lost. This directly costs revenue attribution — we won't know which card generated a commission.

**File**: `src/app/api/analytics/affiliate-click/route.ts`

**Implementation**:
```typescript
async function insertWithRetry(payload: AffiliateClick, maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await supabase.from('affiliate_clicks').insert(payload);
    if (!error) return;
    if (attempt === maxAttempts) {
      logger.error('Affiliate click insert failed after retries', error, { payload });
      return; // Don't fail the redirect — the user's click still works
    }
    await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // 100ms, 200ms backoff
  }
}
```

**Critical**: The retry must NOT block the redirect response. Fire `insertWithRetry()` and immediately return the redirect. Use `waitUntil` if available (Vercel edge), or `void insertWithRetry(...)` for serverless (best-effort tracking is acceptable here — the redirect is the user-critical path).

**Acceptance criteria**: A simulated DB failure (temporarily invalid Supabase URL in test env) still completes the affiliate redirect. Three retry attempts are logged before giving up.

---

### Q8 · Move hardcoded booking URLs from AI prompt to DB/config

**Why**: The AI advisor prompt contains hardcoded URLs for booking award travel (e.g., `https://www.united.com/...`, `https://krisflyer.com/...`). Airlines change booking portal URLs. When this happens, the AI gives users broken links, and fixing it requires a code deploy — not a DB update.

**What to do**:
1. Add a `booking_url TEXT` column to the `programs` table via migration (`supabase/migrations/022_program_booking_url.sql`)
2. Populate it for all programs in the migration (use `UPDATE programs SET booking_url = '...' WHERE slug = '...'`)
3. In the AI prompt builder, fetch program records (already done for other fields) and include `booking_url` from the DB record:
   ```
   To book [program name] awards, use: {program.booking_url}
   ```
4. Remove all hardcoded booking URLs from the prompt template

**Acceptance criteria**: Program booking URLs are editable from the admin UI (via the existing admin valuations endpoint or a new programs endpoint). Changing a URL in the DB is reflected in the AI's next response without a deploy. No booking URLs remain hardcoded in the prompt template string.

---

### Q9 · Add CORS headers to all error responses in middleware

**Why**: The middleware adds CORS headers (`Access-Control-Allow-Origin`, etc.) to successful responses but skips them on error responses (`NextResponse.json({ error: ... }, { status: 4xx/5xx })`). Browsers block error responses from cross-origin fetches if CORS headers are absent, so the frontend JavaScript never receives the error body — it just sees an opaque network error. This makes debugging in staging/dev environments very difficult.

**File**: `middleware.ts`

**Fix**: Extract a `corsHeaders` constant and apply it to every response, including error responses:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// When returning an error:
return NextResponse.json(
  { error: { code: 'cors_blocked', message: 'Origin not allowed' } },
  { status: 403, headers: corsHeaders }  // ← add headers here
);
```

Audit every `return NextResponse.json(...)` with a 4xx/5xx status in middleware.ts and ensure `corsHeaders` is spread into the headers.

**Acceptance criteria**: A cross-origin fetch to any API route that returns a 4xx error still delivers the error body to the browser JavaScript (not an opaque error). Verify with `fetch` from browser console to a non-whitelisted origin — the response body should be readable (status still 403, but CORS headers present so JS can read the response).

---

## Sprint 16 — Sprint 15 PR Fixes (Two Blockers Found in Review)

> **PM note**: Kimi's Sprint 15 PR (branch `sprint-15-engineering-quality`) was reviewed before merge and two issues were found. These must be fixed on that branch before it can merge. Do NOT open a new PR — push fixes directly to `sprint-15-engineering-quality`.

### R1 · Fix affiliate-click fire-and-forget: return 500 when all DB retries fail

**Why**: Kimi's Q7 implementation fires the DB insert with retry logic but always returns `{ ok: true }` to the client — even when all 3 attempts fail. Analytics clicks are silently lost with no signal. This directly hurts revenue attribution.

**File**: `src/app/api/analytics/affiliate-click/route.ts`

**Current behavior (wrong)**:
```typescript
// After all retries exhausted:
logError('Affiliate click insert failed', error, { ... })
// Falls through and still returns { ok: true }
```

**What to fix**: After the final retry attempt fails, return a `500` response instead of swallowing the error:
```typescript
async function insertWithRetry(...): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await supabase.from('affiliate_clicks').insert(payload)
    if (!error) return { ok: true }
    if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 100 * attempt))
  }
  return { ok: false, error: 'DB insert failed after retries' }
}

// In handler:
const result = await insertWithRetry(payload)
if (!result.ok) {
  logError('Affiliate click lost after retries', null, { payload })
  return internalError('Failed to record affiliate click')
}
return Response.json({ ok: true })
```

**Note**: The affiliate redirect (the user navigating to the partner site) should already have happened before this route is called, so returning 500 here does not affect the user's navigation — it only affects whether the frontend retries.

**Acceptance criteria**: When the Supabase insert fails on all 3 attempts, the route returns `500`. When it succeeds on any attempt, it returns `{ ok: true }`. No silent data loss path exists.

---

### R2 · Restore NaN guard in `fmt()` helper in calculator page

**Why**: Kimi's Sprint 15 commit simplified the `fmt()` helper in `src/app/[region]/calculator/page.tsx` by removing its null/NaN guard. The guard was previously:
```typescript
function fmt(cents: number | null | undefined, symbol: string): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return `${symbol}${new Intl.NumberFormat(...).format(cents / 100)}`
}
```
Without this guard, any falsy or NaN value passed to `fmt()` will render as `${symbol}NaN` or `${symbol}0` instead of `—`. This re-introduces the NaN display bug (K2) that was separately tracked.

**File**: `src/app/[region]/calculator/page.tsx`

**What to fix**: Restore the null/NaN safety check in the `fmt()` function. Do not change any of Kimi's other changes in this file (the program ID validation logic from Q6 is correct and should be kept).

**Acceptance criteria**: A program with a `null` or `undefined` `cpp_cents` value in the API response renders `—` in the calculator UI, not `NaN` or `$NaN`. Verified by temporarily setting a program's value to `null` in the API mock or Supabase.

---

## Sprint 17 — Architecture: Data Access Layer

> **Context**: A full system design audit found 161 scattered Supabase `.from()` calls across 40+ files with no consistent pattern. Schema changes require hunting through the entire codebase. Queries are duplicated, not composable, and have inconsistent error handling. This sprint creates a repository layer that becomes the single way to access the database.
>
> **Rule**: After this sprint, no new `.from()` calls are allowed outside of `src/lib/db/`. Every existing direct query stays where it is for now — we only build new repositories as needed. Do not do a big-bang migration.

### A1 · Create `src/lib/db/` repository layer — cards, programs, valuations

**Why**: The three most-queried tables (`cards`, `programs`, `latest_valuations`) are accessed from 8+ different routes with duplicated query logic. `/api/cards/route.ts` alone makes 3 separate sequential queries that should be a single batched fetch.

**What to build** — create these files:

**`src/lib/db/cards.ts`**
```typescript
import { createAdminClient } from '@/lib/supabase'
import type { Card, CardWithRates } from '@/types/database'

/** All active cards with earning rates and latest valuations, optionally filtered by geography */
export async function getActiveCards(geography?: 'US' | 'IN'): Promise<CardWithRates[]> {
  const db = createAdminClient()
  const [cardsRes, valuationsRes, ratesRes] = await Promise.all([
    db.from('cards')
      .select('id, name, short_name, slug, program_slug, annual_fee_usd, currency, signup_bonus_pts, earn_unit, apply_url, is_active, geography, color_hex')
      .eq('is_active', true)
      .order('name'),
    db.from('latest_valuations').select('program_id, cpp_cents'),
    db.from('card_earning_rates').select('card_id, category, multiplier'),
  ])
  if (cardsRes.error) throw new Error(`cards fetch failed: ${cardsRes.error.message}`)
  if (valuationsRes.error) throw new Error(`valuations fetch failed: ${valuationsRes.error.message}`)
  if (ratesRes.error) throw new Error(`rates fetch failed: ${ratesRes.error.message}`)

  const valuationMap = new Map(valuationsRes.data.map(v => [v.program_id, v.cpp_cents]))
  const ratesMap = new Map<string, Record<string, number>>()
  for (const r of ratesRes.data) {
    if (!ratesMap.has(r.card_id)) ratesMap.set(r.card_id, {})
    ratesMap.get(r.card_id)![r.category] = r.multiplier
  }

  let cards = cardsRes.data
  if (geography) cards = cards.filter(c => c.geography === geography)

  return cards.map(card => ({
    ...card,
    cpp_cents: valuationMap.get(card.program_slug) ?? 0,
    earning_rates: ratesMap.get(card.id) ?? {},
  }))
}
```

**`src/lib/db/programs.ts`**
```typescript
/** Active programs for a given region, used by calculator wallet selector */
export async function getActivePrograms(geography?: 'US' | 'IN') { ... }

/** Program by slug — used by valuation pages */
export async function getProgramBySlug(slug: string) { ... }
```

**`src/lib/db/valuations.ts`**
```typescript
/** Latest CPP values for all active programs */
export async function getLatestValuations() { ... }

/** Latest CPP for a single program */
export async function getProgramValuation(programSlug: string) { ... }
```

**Then migrate `/api/cards/route.ts`** to use `getActiveCards()` — replace the 3 sequential queries with 1 repository call. This should reduce the route from ~80 lines to ~30 lines.

**Do NOT yet migrate** other routes — we'll migrate incrementally as routes are touched.

**Acceptance criteria**:
- `src/lib/db/cards.ts`, `programs.ts`, `valuations.ts` exist with full type safety
- `/api/cards/route.ts` uses `getActiveCards()` — no direct `.from()` calls remain in that file
- Build passes, all existing `/api/cards` tests pass
- Response shape is identical to before (no breaking change)
- Batched queries: 3 parallel Promise.all instead of sequential (measurable in Network tab: response time drops)

---

### A2 · Fix N+1 and sequential queries — migrate 3 highest-traffic routes

**Why**: After A1 establishes the pattern, apply it to the next 3 most-impactful routes.

**Routes to migrate** (in order):

1. **`/api/programs/route.ts`**: Already fetches in one query — add it to `programs.ts` repository, keep the route thin.

2. **`/api/calculate/route.ts`**: Currently calls `calculateRedemptions()` which loads programs + valuations + transfer_partners in 3 separate queries. Wrap these 3 in `Promise.all` inside `src/lib/calculate.ts` if not already, and extend the reference cache TTL from 120s to **600s** (10 min). Valuations don't change frequently.

3. **`/api/ai/recommend/route.ts`**: Currently fetches program valuations separately from the main balance data. Use `getLatestValuations()` from the repository so it reuses the same cached data path.

**Acceptance criteria**: `grep -r "\.from(" src/app/api/cards src/app/api/programs src/app/api/calculate src/app/api/ai/recommend` returns 0 results. All routes use repository functions. Build passes.

---

### A3 · Standardize all API routes to use `error-utils.ts` — eliminate raw `NextResponse.json` error returns

**Why**: 31 admin routes and some API routes still use `return NextResponse.json({ error: '...' }, { status: ... })` instead of the standardized `badRequest()` / `internalError()` / `notFound()` helpers. This creates inconsistent error shapes that the frontend has to handle case-by-case.

**Search for all non-standard error returns**:
```bash
grep -rn "NextResponse.json.*error.*status" src/app/api/ | grep -v "error-utils"
```

**Fix pattern** — replace every instance with the appropriate helper from `src/lib/error-utils.ts`:
- `{ error: 'Missing fields' }, { status: 400 }` → `badRequest('Missing fields')`
- `{ error: 'Internal error' }, { status: 500 }` → `internalError('Internal error')`
- `{ error: 'Not found' }, { status: 404 }` → `notFound('Not found')`
- `{ error: 'Unauthorized' }, { status: 401 }` → `unauthorized()`
- `{ error: 'Forbidden' }, { status: 403 }` → `forbidden()`

Also replace all remaining `console.error(...)` calls in API routes with `logError(...)` from `src/lib/logger.ts`. Search: `grep -rn "console.error" src/app/api/`

**Acceptance criteria**:
- Zero `NextResponse.json(.*error.*status` patterns in `src/app/api/` (verified by grep)
- Zero `console.error` calls in `src/app/api/` (verified by grep)
- All error responses are shaped as `{ error: { code: string, message: string } }`
- Build passes, all existing tests pass

---

## Sprint 18 — Architecture: Component Decomposition

> **Context**: `calculator/page.tsx` is 2033 lines with 33 `useState` hooks. It handles data fetching, business logic, AI chat, form input, results display, trip planning, and preferences — all in one component. This is the single highest-risk file in the codebase: one bad edit breaks the entire product. This sprint extracts it into focused, testable pieces.
>
> **Strategy**: Do NOT rewrite. Extract incrementally. The page stays as the orchestrator — we pull out sub-features one at a time. After each extraction, verify the build and manually test the affected feature.

### B1 · Extract `useCalculatorState` hook from calculator/page.tsx

**Why**: 33 `useState` calls in one component create a state spaghetti that's impossible to reason about. Every state change potentially triggers a full re-render of 2000 lines of JSX.

**What to build** — create `src/hooks/useCalculatorState.ts`:

This hook owns ALL calculator state and exposes only a clean interface:
```typescript
// src/hooks/useCalculatorState.ts
export type CalculatorState = {
  // Balance input
  rows: BalanceRow[]
  // Results
  results: CalculateResponse | null
  resultsLoading: boolean
  // AI advisor
  aiHistory: GeminiTurn[]
  aiLoading: boolean
  aiMessage: string
  // Preferences
  preferences: UserPreferences | null
  // UI
  activeTab: 'calculator' | 'results' | 'ai'
  notification: Notification | null
}

export type CalculatorActions = {
  addRow: () => void
  removeRow: (id: string) => void
  updateRow: (id: string, field: keyof BalanceRow, value: string) => void
  calculate: () => Promise<void>
  sendAiMessage: (message: string) => Promise<void>
  setActiveTab: (tab: CalculatorState['activeTab']) => void
  clearNotification: () => void
}

export function useCalculatorState(region: Region): [CalculatorState, CalculatorActions] {
  // Move ALL 33 useState calls here
  // Move ALL useEffect chains here
  // Move calculateHandler, aiHandler functions here
  // Return clean [state, actions] tuple
}
```

**Then in `calculator/page.tsx`**: Replace all 33 `useState` calls with:
```typescript
const [state, actions] = useCalculatorState(region)
```

The page component becomes an orchestrator that only renders — no business logic.

**Acceptance criteria**:
- `src/hooks/useCalculatorState.ts` exists and exports the hook
- `calculator/page.tsx` has zero `useState` calls at the top level (all delegated to hook)
- Page line count drops from 2033 to < 1400
- Build passes, calculator still works end-to-end (balance entry → calculate → results → AI chat)
- Hook is importable independently (no circular deps)

---

### B2 · Extract `<AwardResults>`, `<BalanceInputPanel>`, and `<AIChat>` from calculator

**Why**: After B1, the page still has 3 major rendering sections (1400 lines of JSX) that each warrant their own component file for readability and future testability.

**What to extract** — create these components:

**`src/components/calculator/BalanceInputPanel.tsx`** (~150 lines)
- The multi-row balance input with program selectors and amount fields
- Props: `rows`, `programs`, `onAddRow`, `onRemoveRow`, `onUpdateRow`, `region`
- No state of its own — pure controlled component

**`src/components/calculator/AwardResults.tsx`** (~200 lines)
- The results table/cards showing redemption options ranked by value
- Props: `results`, `selectedResult`, `onSelectResult`, `region`, `narrative`
- Includes the "Best Potential Value" banner
- No state except which result is selected

**`src/components/calculator/AIChat.tsx`** (~150 lines)
- The AI advisor chat interface
- Props: `history`, `loading`, `onSendMessage`, `collapsed`, `onToggleCollapse`, `region`
- Renders the message thread and input box

**Then in `calculator/page.tsx`**: Replace the 3 sections with:
```tsx
<BalanceInputPanel rows={state.rows} programs={programs} ... />
<AwardResults results={state.results} ... />
<AIChat history={state.aiHistory} ... />
```

**Acceptance criteria**:
- 3 new component files exist in `src/components/calculator/`
- Each file is < 250 lines
- `calculator/page.tsx` drops from ~1400 to < 600 lines
- Build passes, full end-to-end flow works
- Components are typed: no implicit `any`, no missing prop types

---

### B3 · Extract `useAwardSearch` hook from award-search/page.tsx

**Why**: `award-search/page.tsx` (683 lines) has the same problem as the calculator — state, fetching, and rendering are all tangled. The award search logic (building params, calling API, handling results/narrative) should be a reusable hook because the same logic could power the Inspire Me page and the Calculator's embedded award search.

**What to build** — `src/hooks/useAwardSearch.ts`:
```typescript
export function useAwardSearch(region: Region) {
  // State: params (origin, dest, dates, cabin, passengers)
  // State: results, loading, error
  // State: narrative, narrativeLoading
  // Action: search(params, balances)
  // Action: clearResults()
  return { params, setParams, results, narrative, loading, error, search }
}
```

**Then** both `award-search/page.tsx` AND `inspire/page.tsx` can use this hook, removing duplicated fetch logic.

**Acceptance criteria**:
- `src/hooks/useAwardSearch.ts` exists
- `award-search/page.tsx` drops from 683 to < 350 lines
- `inspire/page.tsx` uses `useAwardSearch` for its search calls (if applicable)
- Build passes, award search works end-to-end

---

## Sprint 19 — Architecture: Testing Foundation

> **Context**: 0% page component test coverage. ~15% API route coverage. No integration tests. The codebase has been growing via AI agents (Kimi + Codex) with no regression safety net. One bad merge can silently break India vs US parity, the scoring algorithm, or the AI advisor. This sprint establishes the minimum test infrastructure to safely continue product development.
>
> **Tool**: Vitest (already installed). Use `@testing-library/react` for component tests. Mock Supabase and external APIs at the module boundary.
>
> **Philosophy**: Don't aim for 100% coverage. Test the things that break silently and are hard to catch in manual QA: scoring algorithms, currency formatting, region routing, API error shapes.

### C1 · Unit tests for all scoring and formatting logic

**Why**: The card scoring algorithm (in `card-recommender/page.tsx`), the calculate redemptions logic (`src/lib/calculate.ts`), and currency formatting helpers are the most critical logic paths. A bug here affects every user's recommendation. They have no tests.

**What to write** — test files:

**`src/lib/calculate.test.ts`** (extend existing):
```typescript
// Test: Higher CPP program ranks above lower CPP, all else equal
// Test: Transfer partner that needs 2x points still beats cash if CPP is 3x
// Test: India programs rank by paise correctly (cpp_cents in paise, not cents)
// Test: Zero balance returns empty results, not an error
// Test: Single very large balance doesn't overflow
```

**`src/app/[region]/card-recommender/scoring.test.ts`** (new):
```typescript
// Test: goalMatchScore returns 0 for card with no matching goals
// Test: goalMatchScore returns N for N matching goals
// Test: finalScore with goals selected — non-matching card gets 0.3x penalty
// Test: finalScore with goals selected — matching card gets 1.4x boost
// Test: Card ranking changes when travel goal is added
// Test: Signup bonus excluded when hasCardAlready = true
// Test: Annual fee subtracted from firstYearValue
```

**`src/lib/formatters.test.ts`** (new):
```typescript
// Test: fmt(null, '$') returns '—'
// Test: fmt(NaN, '$') returns '—'
// Test: fmt(10000, '$') returns '$100'
// Test: formatCpp(150, 'in') returns '150 paise/pt'
// Test: formatCpp(2.5, 'us') returns '2.50¢/pt'
// Test: formatCpp(null, 'us') returns '—'
```

**Acceptance criteria**: `npm run test` passes with 0 failures. At least 20 test cases covering scoring + formatting. No mocks needed for pure functions.

---

### C2 · API route integration tests — critical paths

**Why**: The 6 existing API tests cover happy paths only. Error paths, validation, and region-specific behavior are untested. A change to the `/calculate` cache key or `/cards` geography filter can silently break India users.

**What to write**:

**`src/app/api/calculate/route.test.ts`** (extend):
```typescript
// EXISTING: happy path
// ADD: Test empty balances → 400
// ADD: Test balances with invalid program_id → 400
// ADD: Test negative amount → 400
// ADD: Test cache HIT on identical request
// ADD: Test rate limit exceeded → 429
// ADD: Test Supabase down → 500 (mock DB to throw)
```

**`src/app/api/cards/route.test.ts`** (extend):
```typescript
// EXISTING: returns cards
// ADD: geography=IN returns only India cards (no Chase UR etc.)
// ADD: geography=US returns only US cards (no HDFC etc.)
// ADD: Missing geography param → returns all or defaults to US (document the behavior)
// ADD: Invalid geography → 400
```

**`src/app/api/ai/recommend/route.test.ts`** (extend):
```typescript
// ADD: Empty balances → returns clarifying response (not AI call)
// ADD: India region → system prompt contains 'paise' not 'cents'
// ADD: US region → system prompt contains 'cents' not 'paise'
// ADD: Gemini timeout → returns 500 (mock Gemini to time out)
```

**Acceptance criteria**: `npm run test` passes. At least 15 new test cases. All error paths covered for calculate, cards, and recommend routes.

---

### C3 · Region parity smoke tests

**Why**: India and US share the same codebase but different data, currencies, and defaults. Bugs that only affect one region go undetected until a user reports them. We need automated checks that both regions produce valid outputs for key operations.

**What to write** — `src/tests/region-parity.test.ts`:
```typescript
describe('Region parity', () => {
  for (const region of ['us', 'in'] as const) {
    describe(`region: ${region}`, () => {
      it('programs API returns programs', async () => {
        const res = await GET(mockRequest({ geography: region === 'us' ? 'US' : 'IN' }))
        const body = await res.json()
        expect(body.cards.length).toBeGreaterThan(0)
        // US should have no India programs
        if (region === 'us') {
          expect(body.cards.every(c => c.geography === 'US')).toBe(true)
        }
        // India should have no US programs
        if (region === 'in') {
          expect(body.cards.every(c => c.geography === 'IN')).toBe(true)
        }
      })

      it('calculate returns results', async () => {
        // Use a known program ID for each region
        const programId = region === 'us' ? US_TEST_PROGRAM_ID : IN_TEST_PROGRAM_ID
        const res = await POST(mockRequest({ balances: [{ program_id: programId, amount: 50000 }] }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.results.length).toBeGreaterThan(0)
        expect(body.total_optimal_value_cents).toBeGreaterThan(0)
      })

      it('CPP values are in correct units for region', async () => {
        // India CPP should be in paise (typically 100-200 range)
        // US CPP should be in cents (typically 1-3 range)
        const results = await calculate(regionTestBalances[region])
        const cpp = results.results[0].cpp_cents
        if (region === 'in') expect(cpp).toBeGreaterThan(50)   // paise
        if (region === 'us') expect(cpp).toBeLessThan(10)       // cents
      })
    })
  }
})
```

**Acceptance criteria**: Region parity tests run in CI. If someone accidentally makes India return US programs, this test catches it. If someone breaks the CPP unit conversion, this catches it. Zero flaky tests (all deterministic with mocked DB).

---

## Architecture Principles — Standing Rules for All Future Code

> These apply to ALL future Codex sprints and Kimi tasks. Violations will block PR approval.

### Rule 1: No direct `.from()` calls in page components or API routes
All database access goes through `src/lib/db/` repository functions. If a repository function doesn't exist for what you need, create it.

### Rule 2: Page components must be < 600 lines
If a page component exceeds 600 lines, extract the excess into a custom hook (`src/hooks/`) or child component (`src/components/[feature]/`).

### Rule 3: No new `console.error` / `console.log` in `src/`
Use `logError()` / `logInfo()` / `logWarn()` from `src/lib/logger.ts` everywhere.

### Rule 4: All API error responses use `error-utils.ts`
Never return raw `NextResponse.json({ error: '...' }, { status: N })`. Always use `badRequest()`, `internalError()`, `notFound()`, `unauthorized()`, `forbidden()`, `rateLimited()`.

### Rule 5: All new features need at least one test
Every new API route needs a test file. Every new utility function needs unit tests. No exceptions.

### Rule 6: Currency and region logic is always explicit
No hardcoded `$`, `¢`, `₹`, or `JFK` / `DEL` in components. Use the `region` parameter + a formatter function. Formatters live in `src/lib/formatters.ts`.
