# PointsMax — Kimi Task Backlog

> Tasks assigned to Kimi. Separate from CODEX_TASKS.md (Codex handles infrastructure/automation).
> Read every file referenced before touching it. Run `npm run build` before opening a PR.
> Each task has explicit acceptance criteria — verify all of them before marking done.

---

## Priority 1 — Critical Bugs (Broken UX, Fix Immediately)

---

### K1 · Fix region filtering — India page must never show US programs

**Why**: The India calculator, wallet selector, and quick value widget are showing Chase UR, Amex MR US, and other US programs to Indian users. This is the most trust-destroying bug on the product.

**Root cause** (confirmed by code audit):
- `src/app/api/programs/route.ts` line 30 filters correctly by `geography` — this works
- BUT `src/app/[region]/page.tsx` has hardcoded `WIDGET_PROGRAMS` fallback data that includes US programs regardless of region
- AND `src/app/[region]/calculator/page.tsx` wallet balance list may render programs before the API response arrives, briefly showing all programs

**Files to fix**:

1. `src/app/[region]/page.tsx` — `WIDGET_PROGRAMS` fallback constant:
   - Split into `WIDGET_PROGRAMS_US` and `WIDGET_PROGRAMS_IN`
   - Select the correct set based on `region`
   - India fallback must contain ONLY: hdfc-millennia, axis-edge, amex-india-mr, air-india, indigo-6e, taj-innercircle
   - US fallback must contain ONLY: chase-ur, amex-mr, capital-one, citi-thankyou, bilt, united, delta, american

2. `src/app/[region]/calculator/page.tsx` — wallet program selector:
   - While API is loading, show a skeleton/spinner instead of unfiltered programs
   - Never render programs from the wrong region even briefly
   - After API load, confirm the program list only contains programs matching the current region

**Acceptance criteria**:
- Visit `/in` — zero US programs in any dropdown or widget
- Visit `/us` — zero India programs in any dropdown or widget
- Network tab: `/api/programs?region=IN` returns only India programs, `/api/programs?region=US` returns only US programs

---

### K2 · Fix NaN in "Best Potential Value"

**Why**: The calculator results panel shows "Best Potential Value: NaN" — a raw JavaScript error leaking to the user. This destroys trust immediately.

**Root cause**: `total_optimal_value_cents` from the API is `null`, `undefined`, or `0` when no valid redemptions are found, and the display code divides/formats it without a null check.

**File**: `src/app/[region]/calculator/page.tsx`

**Search for**: `total_optimal_value_cents`, `bestValue`, `optimal_value` — wherever the "best potential value" display is rendered

**Fix pattern**:
```typescript
// Before formatting any monetary value, guard against falsy:
const displayValue = total_optimal_value_cents
  ? formatCurrency(total_optimal_value_cents / 100, region)
  : '—'  // em-dash, not "NaN" or "$0"
```

Apply the same guard to every monetary field in the results panel (`total_cashback_value_cents`, `cpp_cents`, any derived math).

**Acceptance criteria**: Running the calculator with any combination of inputs never shows "NaN", "undefined", "$NaN", or "₹NaN" anywhere on the page. When value cannot be calculated, show "—" or "Calculating..." instead.

---

### K3 · Fix "Inspire Me" / AI Advisor — broken for Indian programs, fixed rates for US

**Why**: The AI advisor ("Inspire Me") has two bugs:
1. For Indian users: doesn't return useful advice because it doesn't know Indian program slugs or uses USD CPP values
2. For US users: uses hardcoded CPP rates in the prompt instead of live values from the DB

**File**: `src/app/api/ai/recommend/route.ts`

**What to fix**:
1. The prompt builder must pass `program.slug`, `program.cpp_cents`, and `region.currency` to Gemini — **read these from the DB at request time**, not from a hardcoded constant
2. For India: ensure the prompt uses paise values correctly and the AI response references Indian transfer partners (Air India Maharaja Club, Taj InnerCircle, Accor, etc.), not United/Hyatt
3. The prompt must include the correct currency label: "₹X per point (X paise)" for India, "X¢ per point" for US
4. If `balances` array is empty, return a helpful "Add your point balances above to get personalised advice" message instead of an AI call

**Test**: In the India calculator, add 50,000 HDFC points, click "Inspire Me" — the response must reference Air India, Taj, or Accor redemptions in ₹ values, not Chase transfer partners in dollars.

**Acceptance criteria**:
- India "Inspire Me" returns India-specific advice in INR
- US "Inspire Me" uses live CPP values from `latest_valuations` view, not hardcoded numbers
- Empty balances shows a prompt to add balances (no AI call, no error)

---

### K4 · Fix travel goal filter — must actually change card rankings

**Why**: Selecting "International Business Class" as travel goal returns the same card ranking as selecting "Hotel stays". The filter is visual-only — it doesn't meaningfully change results.

**File**: `src/app/[region]/card-recommender/page.tsx`

**Current logic** (line ~126):
```typescript
finalScore = firstYearValue * (1 + 0.1 * goalCount)
```
A 10% boost per matching goal is too weak — a card with $1,500 base value beats a card with $1,200 base value even if the $1,200 card perfectly matches the travel goal and the $1,500 card has zero matching goals.

**Fix**: When a travel goal is selected, the scoring must **heavily prioritize** goal-matching cards:
```typescript
// If user has selected travel goals:
if (selectedGoals.length > 0) {
  const hasAnyMatch = goalCount > 0
  if (!hasAnyMatch) {
    // Card doesn't serve this goal at all — heavy penalty
    finalScore = firstYearValue * 0.3
  } else {
    // Card matches — boost scales with match quality
    finalScore = firstYearValue * (1 + 0.4 * goalCount)
  }
} else {
  // No goal selected — rank purely by value
  finalScore = firstYearValue
}
```

Also add a visual indicator on each card showing why it ranked: "Excellent for international business class" or "Not ideal for your travel goals".

**Acceptance criteria**:
- Select "Hotel stays" → top 3 results are hotel cards (Hyatt, Hilton, Marriott for US; Taj InnerCircle for India)
- Select "International Business Class" → top 3 results are transferable points cards with airline partners
- Select "Domestic flights" → results shift toward co-branded airline cards
- Changing goal selection visibly reorders the card list

---

### K5 · Fix flexible date display in Trip Builder — no more "------"

**Why**: When "I'm flexible (full month)" is selected in the Trip Builder, the month picker shows as "------" which looks broken and unfinished.

**Root cause**: `src/app/[region]/trip-builder/page.tsx` uses `<input type="month">` which renders as `"------"` when the value is empty. There is no placeholder and no custom styling.

**Files**: `src/app/[region]/trip-builder/page.tsx`

**Fix**:
1. Replace `<input type="month">` with a styled month/year selector using two `<select>` dropdowns (month name + year) — this is predictable cross-browser:
```tsx
// Month select: January, February, ..., December
// Year select: current year, current year + 1, current year + 2
// Combined value: "2026-03" format for compatibility
```
2. Default the flexible month to **2 months from today** (not empty)
3. Show a human-readable label: "March 2026" not "2026-03"

**Acceptance criteria**: Switching to "I'm flexible" shows a clean month/year selector with a sensible default. No "------" or browser-native date controls visible. Works identically in Chrome, Safari, and Firefox.

---

## Priority 2 — UX Fixes (Ship This Week)

---

### K6 · Rewrite landing page hero — utility-first, not bank-specific

**Why**: The current hero ("Most HDFC Infinia holders redeem points at ₹0.33 each. You can get ₹1.50.") is too specific to one card. PointsMax supports all Indian and US cards. A new user with Axis Atlas or Amex India shouldn't feel like this product isn't for them.

**The direction**: Minimalist, utility-first. Lead with the problem, show the tool, let the widget prove the value. No specific bank names in the hero.

**File**: `src/app/[region]/page.tsx` — update `HERO_COPY` constant

**New India hero**:
```
Headline:  "Your credit card points are worth more than you think."
Subhead:   "PointsMax calculates the real value of your points and shows you the highest-value redemption — before you transfer."
CTA:       "Check my points value"  (→ scrolls to widget, no signup required)
Trust:     "Free · No signup required · Takes 30 seconds"
```

**New US hero**:
```
Headline:  "Stop leaving money on the table with your points."
Subhead:   "PointsMax finds the redemption that gets you 3–5× more value than cash back — across all your cards."
CTA:       "Check my points value"
Trust:     "Free · No signup required · Takes 30 seconds"
```

**Remove**: Any hardcoded specific card names (HDFC Infinia, Chase Sapphire) from the hero section. The quick value widget below the hero lets users self-select their card.

**Acceptance criteria**: Hero copy mentions no specific card/bank names. CTA scrolls directly to the quick value widget. Both `/in` and `/us` have distinct but parallel structure.

---

### K7 · Fix default airports — India site must default to Indian airports

**Why**: The Quick Award Check on the India landing page defaults to JFK (or US airport codes). Indian users have no idea what JFK is. The defaults should reflect the most common India routes.

**Files**:
- `src/app/[region]/page.tsx` — quick award check links/inputs
- `src/app/[region]/award-search/page.tsx` — origin/destination defaults

**Fix**:
In `award-search/page.tsx`, default origin/destination based on region:
```typescript
const defaultOrigin = region === 'in' ? 'DEL' : 'JFK'
const defaultDestination = region === 'in' ? 'LHR' : 'LHR'  // London is aspirational for both
```

Popular India default routes to consider: DEL→DXB, BOM→LHR, DEL→SIN, BOM→BKK

On the landing page quick award check, if there are pre-filled airport values, swap them for India region.

**Acceptance criteria**: Visiting `/in/award-search` shows DEL as origin by default. `/us/award-search` shows JFK. Landing page quick links use the correct regional airports.

---

### K8 · Fix default monthly spending — make it realistic for premium cardholders

**Why**: The default spending values underrepresent our target user. The Earning Calculator defaults to spending levels of a budget household, not a premium cardholder who spends on HDFC Infinia or Chase Sapphire Reserve.

**File**: `src/lib/regions.ts` — `defaultSpend` in both `us` and `in` REGIONS configs

**New US defaults** (targeting Chase Sapphire Reserve / Amex Platinum user):
```typescript
defaultSpend: {
  dining:     '800',   // was 500 — city dwellers eat out more
  groceries:  '600',   // was 400
  travel:     '1500',  // was 300 — premium card users travel frequently
  gas:        '150',   // was 200 — premium users often drive less
  streaming:  '100',   // was 50 — multiple services
  other:      '2000',  // was 500 — general retail, online shopping
}
```

**New India defaults** (targeting HDFC Infinia / Axis Atlas user):
```typescript
defaultSpend: {
  dining:     '30000',  // was 20000 — restaurant bills for 2 in metro city
  groceries:  '20000',  // was 15000
  travel:     '60000',  // was 10000 — one domestic flight + cabs per month
  fuel:       '8000',   // was 5000 — renamed from 'gas' to 'fuel' for India
  shopping:   '50000',  // NEW category — online shopping is massive in India
  streaming:  '3000',   // was 2000
  other:      '30000',  // was 30000
}
```

Note: Adding `shopping` as a new category for India means also updating the Earning Calculator UI to show this category and the spending input labels (`gas` → `Fuel` for India).

**Acceptance criteria**: Opening the Earning Calculator for the first time shows pre-filled values that feel plausible for a premium cardholder. India shows ₹ amounts. Category label says "Fuel" on India, "Gas" on US.

---

### K9 · Add one-way trip option to Trip Builder

**Why**: A significant portion of award bookings are one-way (positioning flights, open-jaw itineraries). The Trip Builder forces round-trip, which makes it useless for these cases.

**File**: `src/app/[region]/trip-builder/page.tsx`

**What to add**:
1. A toggle at the top: `[Round Trip] [One Way]` — default Round Trip
2. When "One Way" is selected:
   - Hide the return date input
   - Set `returnDate = null` in state
   - Hotel nights auto-calculation should be disabled (no return date to calculate from)
   - The trip summary section should show "One Way · [origin] → [destination]" not assume return
3. Pass `tripType: 'one_way' | 'round_trip'` to the AI prompt so it gives correct booking advice

**Acceptance criteria**: Selecting "One Way" hides the return date. Trip summary reflects one-way. The AI advisor output doesn't tell you to "book your return leg" on a one-way search.

---

## Priority 3 — Product Features (Next Sprint)

---

### K10 · Add signup bonus to card recommendation scoring + add soft benefit tags

**Why (signup bonus)**: The card recommender does calculate `signupValue` but it's not displayed to the user and may not be correctly handling cases where the user already has the card (can't get the bonus again). The signup bonus is often worth more than a year of spending rewards — it needs to be prominent.

**Why (soft benefits)**: Cards like HDFC Infinia (lounge access, golf, concierge) and Amex Platinum (Priority Pass, hotel status) have soft benefits worth ₹30,000-₹80,000/year that are invisible in current scoring. This is a genuine differentiator — no Indian comparison site values these.

**File**: `src/app/[region]/card-recommender/page.tsx`

**Changes**:

1. **Signup bonus display**: Show it prominently on each card tile:
   ```
   ┌─────────────────────────────────────┐
   │ HDFC Infinia                        │
   │ First year value: ₹1,24,000         │
   │   Signup bonus:    ₹75,000  ← show  │
   │   Annual rewards:  ₹52,000           │
   │   Annual fee:     -₹12,500           │
   └─────────────────────────────────────┘
   ```
2. **"Already have this card" toggle**: Small checkbox on each card. If checked, signup bonus is excluded from the score. This is critical — recommending a card someone already has for its bonus is wrong.

3. **Soft benefit tags** (Phase 1 — visual only, no DB changes needed):
   - Add a `benefits` field to the card data (hardcode for now, DB later): lounge access, golf, concierge, hotel status, travel insurance, etc.
   - Display as chips under the card name: `[Lounge Access] [Golf] [Hotel Status]`
   - Add an estimated annual value for each benefit type:
     - Lounge access (Priority Pass equivalent): ₹20,000/year India, $500/year US
     - Golf rounds: ₹15,000/year India
     - Hotel status (Marriott Gold/IHG Platinum): $200/year US
   - Show "Soft benefits est. value: ₹35,000/year" on the card
   - Include this in the total first-year value calculation

**Acceptance criteria**:
- Signup bonus is displayed as a line item on every card tile
- "Already have this card" checkbox removes signup bonus from score and re-sorts list
- At least 3 cards per region show soft benefit tags
- Total value displayed includes soft benefits

---

### K11 · Add more cards — expand coverage for both India and US

**Why**: ~10 cards per region is not enough to be useful. Indian users specifically are looking for: SBI SimplyCLICK, ICICI Amazon Pay, Kotak Royale Signature, Yes Bank Marquee, Flipkart Axis, HDFC Regalia First. US users want to see: Chase Freedom Unlimited, Citi Premier, Wells Fargo Autograph, US Bank Altitude Reserve.

**This is a DB task, not a UI task.**

**New migration file**: `supabase/migrations/022_more_cards.sql`

**India cards to add** (research exact current earn rates from each bank's website before writing SQL — do not guess):

| Card | Issuer | Program | Annual Fee (INR) | Key earn rate |
|---|---|---|---|---|
| SBI SimplyCLICK | SBI | SBI Reward Points | ₹499 | 10x on online spends |
| ICICI Amazon Pay | ICICI | Amazon Pay balance | ₹0 | 5% on Amazon Prime |
| Kotak Royale Signature | Kotak | Kotak PVR Points | ₹1,499 | 4x general |
| Yes Bank Marquee | Yes Bank | Yes Rewardz | ₹9,999 | 12 pts per ₹100 premium |
| Flipkart Axis Bank | Axis | Axis EDGE Rewards | ₹500 | 5% on Flipkart |
| HDFC Regalia First | HDFC | HDFC Millennia Rewards | ₹1,000 | 4x general |
| Standard Chartered EaseMyTrip | Standard Chartered | 360° Reward Points | ₹350 | 5x on travel |

**US cards to add** (research earn rates from issuer websites):

| Card | Issuer | Program | Annual Fee (USD) |
|---|---|---|---|
| Chase Freedom Unlimited | Chase | Chase UR | $0 |
| Chase Freedom Flex | Chase | Chase UR | $0 |
| Citi Premier | Citi | Citi TYP | $95 |
| Wells Fargo Autograph | Wells Fargo | Wells Fargo Rewards | $0 |
| US Bank Altitude Reserve | US Bank | US Bank Altitude | $400 |
| Discover it Miles | Discover | Discover Miles | $0 |
| Capital One SavorOne | Capital One | Capital One Miles | $0 |

**Acceptance criteria**: After migration, `/api/cards?geography=IN` returns at least 14 Indian cards. `/api/cards?geography=US` returns at least 20 US cards. Card recommender shows these cards correctly ranked.

---

### K12 · Better calendar — replace native date inputs with a proper date picker

**Why**: `<input type="date">` and `<input type="month">` render differently in every browser. On mobile Safari they're especially bad. A consistent, well-designed date picker is table stakes for a travel tool.

**Files**: `src/app/[region]/trip-builder/page.tsx`

**Implementation**: Use the `react-day-picker` library (already a dependency of shadcn/ui Calendar component — `npx shadcn@latest add calendar` if not already added).

**What to build**:
- For exact dates: shadcn `<Calendar>` with date range selection (click start, click end)
- For flexible month: two `<Select>` dropdowns (Month + Year) as described in K5
- Visual design: clean popover that opens on click, shows 2 months side-by-side on desktop, 1 month on mobile
- Selected range is highlighted. Today is marked. Past dates are disabled.

**Do NOT**: Build a custom calendar from scratch. Use shadcn/ui Calendar which wraps react-day-picker.

**Acceptance criteria**: Date selection in Trip Builder uses a popover calendar (not native browser input). Works consistently in Chrome, Safari, Firefox, and mobile. Keyboard navigation works (arrow keys, Enter to select).

---

## Notes for Kimi

- **One PR per task** — do not bundle multiple tasks into one PR. Smaller PRs get reviewed faster.
- **Run `npm run build` locally before opening any PR** — CI will catch lint/type errors and fail the build if you don't.
- **India = INR, US = USD** — if you add any new UI text with monetary values, it must be region-aware.
- **Never add US programs to India pages or India programs to US pages** — this is the #1 trust issue.
- **Read the file before editing it** — do not modify code you haven't read in full.
- **Migration numbering**: check the latest migration number in `supabase/migrations/` and use the next sequential number. CI enforces sequential numbering — a gap or duplicate will fail the build.
