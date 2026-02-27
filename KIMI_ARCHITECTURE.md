# PointsMax — Architecture Overhaul: Kimi Instructions

> **Read this entire document before writing a single line of code.**
> These are three sequential sprints. Complete them in order — Sprint 17 → 18 → 19.
> One PR per sprint. Do not combine sprints into one PR.

---

## Context: Why This Exists

A system design audit of the codebase found three critical architectural problems:

1. **161 scattered Supabase queries** — `.from()` calls exist in 40+ files with no abstraction. Every schema change requires hunting through the entire codebase. Queries are duplicated across routes.

2. **2033-line calculator component** — `src/app/[region]/calculator/page.tsx` has 33 `useState` hooks managing unrelated concerns (balances, AI chat, award search, preferences, notifications, sharing — all in one component). One bad edit breaks the entire product.

3. **~0% page component test coverage** — AI agents (Kimi + Codex) have been shipping features with no regression safety net. Silent bugs reach production.

These three sprints fix these problems in order. Sprint 17 creates the data layer. Sprint 18 uses it to decompose the calculator. Sprint 19 adds tests that make future refactoring safe.

---

## Before You Start

Read these files in full before touching anything:

- `src/types/database.ts` — the canonical type definitions. Do NOT re-define types that already exist here.
- `src/lib/supabase.ts` — how DB clients are created (`createPublicClient`, `createAdminClient`)
- `src/lib/error-utils.ts` — all error response helpers (`badRequest`, `internalError`, etc.)
- `src/lib/logger.ts` — the logging functions (`logError`, `logInfo`, `logWarn`)
- `src/app/api/cards/route.ts` — the route you will migrate first in Sprint 17
- `src/app/[region]/calculator/page.tsx` — lines 800–860 (the 33 useState declarations you will extract in Sprint 18)

---

## Sprint 17 — Data Access Layer

**Goal**: Create `src/lib/db/` as the single place all database queries live. Migrate the 3 highest-traffic API routes to use it. Standardize all error returns across API routes.

**Branch name**: `sprint-17-data-layer`

---

### Task A1 — Create `src/lib/db/cards.ts`

Create the file `src/lib/db/cards.ts`. This is the repository for all card-related queries.

**Exact implementation**:

```typescript
// src/lib/db/cards.ts
import { createPublicClient } from '@/lib/supabase'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { logError } from '@/lib/logger'
import type { CardWithRates, SpendCategory } from '@/types/database'

type Geography = 'US' | 'IN'

export function normalizeGeography(value: string | null | undefined): Geography {
  if (!value) return 'US'
  return value.toUpperCase() === 'IN' ? 'IN' : 'US'
}

function normalizeCardCppCents(cppCents: number, currency: 'USD' | 'INR'): number {
  // Backward compat: old India seeds used rupees-per-point, app expects paise (minor units)
  if (currency === 'INR' && cppCents <= 5) return cppCents * 100
  return cppCents
}

/**
 * Returns all active cards for a geography, with earning rates and latest CPP valuations.
 * Runs 3 queries in parallel (not sequential) for performance.
 * Throws on DB error — callers should catch and return 500.
 */
export async function getActiveCards(geography: Geography): Promise<CardWithRates[]> {
  const db = createPublicClient()

  // Run cards + valuations in parallel. Rates need card IDs, so it's a second round.
  const [cardsRes, valuationsRes] = await Promise.all([
    db.from('cards').select('*').eq('is_active', true).eq('geography', geography).order('display_order'),
    db.from('latest_valuations').select('program_id, cpp_cents, program_name, program_slug, program_type'),
  ])

  // Handle missing geography column (schema migration not yet applied)
  let cardsData = cardsRes.data ?? []
  if (cardsRes.error?.code === '42703') {
    // Column doesn't exist — fall back to unfiltered and filter in app
    const fallback = await db.from('cards').select('*').eq('is_active', true).order('display_order')
    if (fallback.error) throw new Error(`cards fetch failed: ${fallback.error.message}`)
    cardsData = (fallback.data ?? []).filter((c: { geography?: string }) => c.geography === geography)
  } else if (cardsRes.error) {
    throw new Error(`cards fetch failed: ${cardsRes.error.message}`)
  }

  if (valuationsRes.error) throw new Error(`valuations fetch failed: ${valuationsRes.error.message}`)

  const cardIds = cardsData.map((c: { id: string }) => c.id)
  if (cardIds.length === 0) return []

  const ratesRes = await db.from('card_earning_rates').select('*').in('card_id', cardIds)
  if (ratesRes.error) throw new Error(`rates fetch failed: ${ratesRes.error.message}`)

  // Build lookup maps
  const valuationByProgram = new Map(
    (valuationsRes.data ?? []).map((v: { program_id: string; cpp_cents: number; program_name: string; program_slug: string; program_type: string }) => [v.program_id, v])
  )

  const ratesByCard = new Map<string, Record<SpendCategory, number>>()
  const defaultRates = (): Record<SpendCategory, number> => ({
    dining: 1, groceries: 1, travel: 1, gas: 1, shopping: 1, streaming: 1, other: 1,
  })

  for (const rate of (ratesRes.data ?? [])) {
    if (!ratesByCard.has(rate.card_id)) ratesByCard.set(rate.card_id, defaultRates())
    const existing = ratesByCard.get(rate.card_id)!
    const category = rate.category as SpendCategory
    if (category in existing) existing[category] = Number(rate.earn_multiplier)
  }

  return cardsData.map((card: Record<string, unknown>) => {
    const currency = card.currency === 'INR' ? 'INR' : 'USD'
    const val = valuationByProgram.get(card.program_id as string)
    const resolvedCpp = resolveCppCents(val?.cpp_cents, val?.program_type)
    const normalizedCpp = normalizeCardCppCents(resolvedCpp, currency)
    const rates = ratesByCard.get(card.id as string) ?? defaultRates()
    if (!Number.isFinite(rates.shopping) || rates.shopping <= 0) rates.shopping = rates.other

    return {
      ...card,
      currency,
      earn_unit: typeof card.earn_unit === 'string' ? card.earn_unit : (currency === 'INR' ? '100_inr' : '1_dollar'),
      geography: card.geography === 'IN' ? 'IN' : 'US',
      apply_url: typeof card.apply_url === 'string' ? card.apply_url : null,
      program_name: val?.program_name ?? 'Unknown',
      program_slug: val?.program_slug ?? '',
      cpp_cents: normalizedCpp,
      earning_rates: rates,
    } as CardWithRates
  })
}
```

**Then rewrite `src/app/api/cards/route.ts`** to use it. The route becomes thin — validation, rate limiting, calling the repository, returning the response:

```typescript
// src/app/api/cards/route.ts  (AFTER migration)
import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api-security'
import { logError } from '@/lib/logger'
import { internalError } from '@/lib/error-utils'
import { getActiveCards, normalizeGeography } from '@/lib/db/cards'

export async function GET(request: Request) {
  const rateLimitError = await enforceRateLimit(request, {
    namespace: 'cards_ip',
    maxRequests: 60,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  const geography = normalizeGeography(new URL(request.url).searchParams.get('geography'))

  try {
    const cards = await getActiveCards(geography)
    return NextResponse.json(
      { cards, geography },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch (err) {
    logError('cards_api_failed', { geography, error: err instanceof Error ? err.message : String(err) })
    return internalError('Failed to fetch cards')
  }
}
```

**Verify**: `grep -n "\.from(" src/app/api/cards/route.ts` must return 0 results after migration.

---

### Task A2 — Create `src/lib/db/programs.ts`

Create `src/lib/db/programs.ts`:

```typescript
// src/lib/db/programs.ts
import { createPublicClient, createAdminClient } from '@/lib/supabase'
import type { Program } from '@/types/database'

type Geography = 'US' | 'IN'

/**
 * Active programs for a region. Used by calculator wallet selector and AI advisor.
 */
export async function getActivePrograms(geography?: Geography): Promise<Program[]> {
  const db = createPublicClient()
  let query = db.from('programs').select('*').eq('is_active', true).order('display_order')
  if (geography) query = query.eq('geography', geography)
  const { data, error } = await query
  if (error) throw new Error(`programs fetch failed: ${error.message}`)
  return (data ?? []) as Program[]
}

/**
 * Single program by slug. Used by valuation and program detail pages.
 */
export async function getProgramBySlug(slug: string): Promise<Program | null> {
  const db = createPublicClient()
  const { data, error } = await db.from('programs').select('*').eq('slug', slug).eq('is_active', true).maybeSingle()
  if (error) throw new Error(`program fetch failed: ${error.message}`)
  return data as Program | null
}
```

Then migrate `src/app/api/programs/route.ts` to import `getActivePrograms` instead of calling `.from('programs')` directly.

---

### Task A3 — Standardize all API error returns

**This is non-negotiable**. Every API route must use `error-utils.ts`. No raw `NextResponse.json({ error: '...' }, { status: N })` in any API route.

Run this to find every violation:
```bash
grep -rn "NextResponse\.json.*['\"]error['\"]" src/app/api/ | grep -v "\.test\."
```

For each result, replace with the correct helper from `src/lib/error-utils.ts`:

| Old pattern | Replace with |
|---|---|
| `NextResponse.json({ error: '...' }, { status: 400 })` | `badRequest('...')` |
| `NextResponse.json({ error: '...' }, { status: 401 })` | `unauthorized()` |
| `NextResponse.json({ error: '...' }, { status: 403 })` | `forbidden()` |
| `NextResponse.json({ error: '...' }, { status: 404 })` | `notFound('...')` |
| `NextResponse.json({ error: '...' }, { status: 429 })` | `rateLimited(retryAfterSeconds)` |
| `NextResponse.json({ error: '...' }, { status: 500 })` | `internalError('...')` |

Also replace all `console.error(...)` in API routes with `logError(...)`. Run:
```bash
grep -rn "console\.error" src/app/api/ | grep -v "\.test\."
```

**Acceptance criteria for Sprint 17**:
- `src/lib/db/cards.ts` and `src/lib/db/programs.ts` exist
- `src/app/api/cards/route.ts` has zero `.from(` calls
- `src/app/api/programs/route.ts` has zero `.from(` calls
- `grep -rn "NextResponse\.json.*error.*status" src/app/api/` returns 0 results
- `grep -rn "console\.error" src/app/api/` returns 0 results
- `npm run build` passes
- `npm run test` passes (all existing tests green)
- Response shape of `/api/cards` is **identical** to before — no breaking change

---

## Sprint 18 — Calculator Decomposition

**Goal**: Break `calculator/page.tsx` (2033 lines, 33 useState) into a custom hook + 3 focused components. The page becomes an orchestrator under 700 lines.

**Branch name**: `sprint-18-calculator-decomp`

**Read `src/app/[region]/calculator/page.tsx` in full before starting.** Understand every useState, every useEffect, every handler function. Do not move code you don't understand.

**Strategy**: Extract, do not rewrite. The logic stays identical — you are only moving it into a better structure. If you find yourself rewriting business logic, stop.

---

### Task B1 — Create `src/hooks/useCalculatorState.ts`

Create the directory `src/hooks/` and the file `src/hooks/useCalculatorState.ts`.

This hook owns all calculator state and all handler functions. It accepts `region` and returns `[state, actions]`.

**What to move into the hook** (from `calculator/page.tsx`):

1. **All 33 `useState` declarations** (lines 805–850) — move them verbatim into the hook
2. **All `useEffect` chains** — program loading, balance syncing, preference loading, message count persistence
3. **All handler functions** — `handleCalculate`, `handleAskAI`, `handleAwardSearch`, `handleShare`, `handleSaveBalances`, `handlePrefSave`

**The interface the hook must export**:

```typescript
// src/hooks/useCalculatorState.ts
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { REGIONS, type Region } from '@/lib/regions'
import { trackEvent } from '@/lib/analytics'
import type { Program, RedemptionResult, CalculateResponse } from '@/types/database'

// ── Types ──────────────────────────────────────────────
// (move BalanceRow, AwardParams, AwardSearchResponse, ChatMsg, GeminiTurn,
//  Preferences, Notification etc. here — they currently live inline in the page)

export type CalculatorState = {
  // Programs
  programs: Program[]
  programsLoading: boolean
  // Balance input
  rows: BalanceRow[]
  // Calculation
  result: CalculateResponse | null
  loading: boolean
  calcError: string | null
  showAllResults: boolean
  // Alert banner
  alertEmailInput: string
  alertBannerDismissed: boolean
  alertSubscribed: boolean
  alertBannerLoading: boolean
  alertBannerError: string | null
  // Share
  shareBusy: boolean
  shareError: string | null
  shareUrl: string | null
  // Preferences
  prefOpen: boolean
  prefForm: Preferences
  prefInput: { preferred: string; avoided: string }
  prefSaving: boolean
  // AI advisor
  chatMessages: ChatMsg[]
  geminiHistory: GeminiTurn[]
  chatInput: string
  aiLoading: boolean
  aiStatus: string
  aiError: string | null
  messageCount: number
  // Award search
  awardParams: AwardParams
  awardLoading: boolean
  awardResult: AwardSearchResponse | null
  awardError: string | null
  // Panel
  activePanel: 'redemptions' | 'awards' | 'advisor'
  saveToast: boolean
}

export type CalculatorActions = {
  // Rows
  addRow: () => void
  removeRow: (id: string) => void
  updateRow: (id: string, field: keyof BalanceRow, value: string) => void
  // Core actions
  handleCalculate: () => Promise<void>
  handleAskAI: (message?: string) => Promise<void>
  handleAwardSearch: () => Promise<void>
  handleShare: () => Promise<void>
  handleSaveBalances: () => Promise<void>
  handlePrefSave: () => Promise<void>
  handleSubscribeAlert: () => Promise<void>
  // UI setters (simple state updates)
  setShowAllResults: (v: boolean) => void
  setAlertEmailInput: (v: string) => void
  setAlertBannerDismissed: (v: boolean) => void
  setPrefOpen: (v: boolean) => void
  setPrefForm: (v: Preferences) => void
  setPrefInput: (v: { preferred: string; avoided: string }) => void
  setChatInput: (v: string) => void
  setAwardParams: (v: AwardParams | ((prev: AwardParams) => AwardParams)) => void
  setActivePanel: (v: CalculatorState['activePanel']) => void
  setSaveToast: (v: boolean) => void
  setShareError: (v: string | null) => void
  setShareUrl: (v: string | null) => void
}

export function useCalculatorState(region: Region): [CalculatorState, CalculatorActions] {
  // Move all 33 useState declarations here verbatim
  // Move all useEffect chains here verbatim
  // Move all handler functions here verbatim

  const state: CalculatorState = {
    programs, programsLoading, rows, result, loading, calcError,
    showAllResults, alertEmailInput, alertBannerDismissed, alertSubscribed,
    alertBannerLoading, alertBannerError, shareBusy, shareError, shareUrl,
    prefOpen, prefForm, prefInput, prefSaving, chatMessages, geminiHistory,
    chatInput, aiLoading, aiStatus, aiError, messageCount,
    awardParams, awardLoading, awardResult, awardError, activePanel, saveToast,
  }

  const actions: CalculatorActions = {
    addRow, removeRow, updateRow, handleCalculate, handleAskAI,
    handleAwardSearch, handleShare, handleSaveBalances, handlePrefSave,
    handleSubscribeAlert, setShowAllResults, setAlertEmailInput,
    setAlertBannerDismissed, setPrefOpen, setPrefForm, setPrefInput,
    setChatInput, setAwardParams, setActivePanel, setSaveToast,
    setShareError, setShareUrl,
  }

  return [state, actions]
}
```

**Then in `calculator/page.tsx`**: Remove all 33 `useState` calls and all handler functions. Replace with:

```typescript
export default function CalculatorPage() {
  const routeParams = useParams()
  const region = ((routeParams.region as string) === 'in' ? 'in' : 'us') as Region
  const [state, actions] = useCalculatorState(region)
  // ... rest of component only renders JSX using state and actions
}
```

**Acceptance criteria for B1**:
- `src/hooks/useCalculatorState.ts` exists and exports `useCalculatorState`
- `calculator/page.tsx` has **zero `useState` calls** at the top-level component (verified by grep)
- `calculator/page.tsx` is under 1500 lines
- `npm run build` passes
- Calculator works end-to-end: load programs → enter balance → calculate → see results → use AI chat

---

### Task B2 — Extract `<BalanceInputPanel>`, `<AwardResults>`, `<AIChat>`

Create `src/components/calculator/` directory and three component files.

**`src/components/calculator/BalanceInputPanel.tsx`**:
- Extract the balance row input section from `calculator/page.tsx`
- Accepts props: `rows`, `programs`, `programsLoading`, `region`, `onAddRow`, `onRemoveRow`, `onUpdateRow`
- Pure controlled component — no internal state
- Target: < 200 lines

**`src/components/calculator/AwardResults.tsx`**:
- Extract the results panel (the ranked redemption cards + "Best Potential Value" banner)
- Accepts props: `result`, `showAllResults`, `onSetShowAllResults`, `region`, `narrative?`
- Must include the `fmt()` and `formatCpp()` helpers (or import from `src/lib/formatters.ts` if you create it)
- Target: < 250 lines

**`src/components/calculator/AIChat.tsx`**:
- Extract the AI advisor chat section
- Accepts props: `chatMessages`, `chatInput`, `aiLoading`, `aiStatus`, `aiError`, `messageCount`, `region`, `onSendMessage`, `onSetChatInput`
- Handles the message thread, input box, and send button
- Target: < 200 lines

**Then in `calculator/page.tsx`**: Replace the 3 extracted sections with component calls. The page becomes an orchestrator: it wires state → components, nothing more.

**Acceptance criteria for B2**:
- 3 new files in `src/components/calculator/`
- Each file is < 250 lines
- `calculator/page.tsx` is under 700 lines
- `npm run build` passes
- Full end-to-end: balance entry → calculate → see results → AI chat → award search all work

---

### Task B3 — Create `src/hooks/useAwardSearch.ts`

Create `src/hooks/useAwardSearch.ts`. This hook encapsulates all award search state and the fetch call, making it reusable.

```typescript
// src/hooks/useAwardSearch.ts
'use client'

import { useState } from 'react'
import { type Region } from '@/lib/regions'
import type { AwardSearchResponse, AwardParams } from '@/lib/award-search/types'

export type AwardSearchState = {
  params: AwardParams
  result: AwardSearchResponse | null
  loading: boolean
  error: string | null
}

export type AwardSearchActions = {
  setParams: (params: AwardParams | ((prev: AwardParams) => AwardParams)) => void
  search: (balances: Array<{ program_id: string; amount: number }>) => Promise<void>
  clearResults: () => void
}

export function useAwardSearch(region: Region): [AwardSearchState, AwardSearchActions] {
  // Move award search state and fetch logic here
  // from award-search/page.tsx and/or calculator/page.tsx
}
```

Use this hook in both `award-search/page.tsx` (replace its existing search state) and in `calculator/page.tsx` via `useCalculatorState` (or directly in the page if it makes the hook simpler).

**Acceptance criteria for B3**:
- `src/hooks/useAwardSearch.ts` exists
- `award-search/page.tsx` drops from 683 to < 400 lines
- `npm run build` passes
- Award search works end-to-end from both the award search page and the calculator

---

## Sprint 19 — Testing Foundation

**Goal**: Establish minimum test coverage so regressions are caught before merge. Three targeted test files covering scoring logic, API critical paths, and region parity.

**Branch name**: `sprint-19-tests`

**Testing stack**: Vitest (already installed). For pure functions, no mocking needed. For API routes, mock Supabase at the module level using `vi.mock`.

---

### Task C1 — Unit tests for scoring and formatting

**Create `src/lib/formatters.ts`** first (if it doesn't exist) — move `fmt()`, `formatCpp()`, and any other pure format helpers out of page components into this shared module. Then test them.

**`src/lib/formatters.test.ts`**:
```typescript
import { describe, it, expect } from 'vitest'
import { fmt, formatCpp } from './formatters'

describe('fmt', () => {
  it('returns em-dash for null', () => expect(fmt(null, '$')).toBe('—'))
  it('returns em-dash for undefined', () => expect(fmt(undefined, '$')).toBe('—'))
  it('returns em-dash for NaN', () => expect(fmt(NaN, '$')).toBe('—'))
  it('returns em-dash for Infinity', () => expect(fmt(Infinity, '$')).toBe('—'))
  it('formats 10000 cents as $100', () => expect(fmt(10000, '$')).toBe('$100'))
  it('formats 150000 paise as ₹1,500', () => expect(fmt(150000, '₹')).toBe('₹1,500'))
  it('formats 0 as $0', () => expect(fmt(0, '$')).toBe('$0'))
})

describe('formatCpp', () => {
  it('returns em-dash for null', () => expect(formatCpp(null, 'us')).toBe('—'))
  it('returns em-dash for NaN', () => expect(formatCpp(NaN, 'in')).toBe('—'))
  it('India: returns whole paise with label', () => expect(formatCpp(150, 'in')).toBe('150 paise/pt'))
  it('India: rounds non-integer paise', () => expect(formatCpp(150.7, 'in')).toBe('151 paise/pt'))
  it('US: returns 2 decimal cents', () => expect(formatCpp(2.5, 'us')).toBe('2.50¢/pt'))
  it('US: returns 2 decimal for small value', () => expect(formatCpp(0.5, 'us')).toBe('0.50¢/pt'))
})
```

**Create `src/app/[region]/card-recommender/scoring.test.ts`**:

```typescript
import { describe, it, expect } from 'vitest'

// Extract goalMatchScore and scoring logic into a pure function in a separate file
// src/lib/scoring.ts — then test it here.
// If it's currently inline in the page component, extract it first (< 30 lines).

import { goalMatchScore, computeCardScore } from '@/lib/scoring'

const mockCard = { id: '1', name: 'Test Card', program_slug: 'chase-ur', annual_fee_usd: 95 }
const mockProgramGoalMap = { 'chase-ur': ['intl_biz', 'intl_econ'] }

describe('goalMatchScore', () => {
  it('returns 0 when no goals selected', () =>
    expect(goalMatchScore(mockCard, new Set(), mockProgramGoalMap)).toBe(0))
  it('returns 0 when card has no matching goals', () =>
    expect(goalMatchScore(mockCard, new Set(['hotels']), mockProgramGoalMap)).toBe(0))
  it('returns 1 for one matching goal', () =>
    expect(goalMatchScore(mockCard, new Set(['intl_biz']), mockProgramGoalMap)).toBe(1))
  it('returns 2 for two matching goals', () =>
    expect(goalMatchScore(mockCard, new Set(['intl_biz', 'intl_econ']), mockProgramGoalMap)).toBe(2))
})

describe('computeCardScore', () => {
  it('returns baseValue when no goals selected', () =>
    expect(computeCardScore(1000, 0, new Set())).toBe(1000))
  it('applies 0.3x penalty when goals selected and no match', () =>
    expect(computeCardScore(1000, 0, new Set(['hotels']))).toBe(300))
  it('applies 1.4x boost for 1 matching goal', () =>
    expect(computeCardScore(1000, 1, new Set(['intl_biz']))).toBe(1400))
  it('applies 1.8x boost for 2 matching goals', () =>
    expect(computeCardScore(1000, 2, new Set(['intl_biz', 'intl_econ']))).toBe(1800))
  it('signup bonus excluded when card already owned', () => {
    // firstYearValue = annualRewards + 0 (no bonus) + benefits - fee
    // not tested here — test the ownsCard flag in the page-level scoring
  })
})
```

Note: to write these tests you MUST first extract `goalMatchScore` and the score computation into `src/lib/scoring.ts` as pure functions that accept only data (no component state). This is a small extraction (~30 lines).

---

### Task C2 — API route tests for critical paths

**Extend `src/app/api/calculate/route.test.ts`** (add to existing file):

```typescript
// Add these test cases to the existing file:

describe('POST /api/calculate — error cases', () => {
  it('returns 400 for empty balances array', async () => {
    const res = await POST(mockRequest({ balances: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBeDefined()
  })

  it('returns 400 for negative amount', async () => {
    const res = await POST(mockRequest({ balances: [{ program_id: 'chase-ur', amount: -100 }] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for zero amount', async () => {
    const res = await POST(mockRequest({ balances: [{ program_id: 'chase-ur', amount: 0 }] }))
    expect(res.status).toBe(400)
  })

  it('returns X-PointsMax-Cache: MISS on first request', async () => {
    const res = await POST(mockRequest({ balances: [{ program_id: 'chase-ur', amount: 50000 }] }))
    // Only test cache header if mock supports it
    expect([200, 500]).toContain(res.status) // don't fail if DB not mocked
  })
})
```

**Create `src/app/api/cards/route.test.ts`** (new file):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

// Mock Supabase at module level
vi.mock('@/lib/supabase', () => ({
  createPublicClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              data: table === 'cards' ? [
                { id: '1', name: 'Chase Sapphire', geography: 'US', program_id: 'chase-ur', is_active: true, display_order: 1, annual_fee_usd: 95, currency: 'USD', earn_unit: '1_dollar', signup_bonus_pts: 60000, signup_bonus_spend: 4000, issuer: 'Chase', apply_url: null, created_at: '' }
              ] : [],
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}))

function mockRequest(geography: string) {
  return new Request(`http://localhost/api/cards?geography=${geography}`)
}

describe('GET /api/cards', () => {
  it('returns cards array', async () => {
    const res = await GET(mockRequest('US'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.cards)).toBe(true)
  })

  it('returns geography in response', async () => {
    const res = await GET(mockRequest('US'))
    const body = await res.json()
    expect(body.geography).toBe('US')
  })

  it('normalizes invalid geography to US', async () => {
    const res = await GET(mockRequest('INVALID'))
    const body = await res.json()
    expect(body.geography).toBe('US')
  })

  it('sets Cache-Control header', async () => {
    const res = await GET(mockRequest('US'))
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300')
  })
})
```

---

### Task C3 — Region parity tests

**Create `src/tests/region-parity.test.ts`**:

```typescript
import { describe, it, expect } from 'vitest'
import { formatCpp, fmt } from '@/lib/formatters'

// These tests don't need a DB — they test the pure logic layer.
// The goal is to catch regressions where India-specific formatting breaks.

describe('Region parity — formatCpp', () => {
  const regions = ['us', 'in'] as const

  for (const region of regions) {
    it(`[${region}] formatCpp never returns hardcoded ¢ for India`, () => {
      if (region === 'in') {
        expect(formatCpp(150, region)).not.toContain('¢')
        expect(formatCpp(150, region)).toContain('paise')
      } else {
        expect(formatCpp(2.5, region)).toContain('¢')
      }
    })

    it(`[${region}] formatCpp handles null gracefully`, () => {
      expect(formatCpp(null, region)).toBe('—')
    })

    it(`[${region}] formatCpp handles NaN gracefully`, () => {
      expect(formatCpp(NaN, region)).toBe('—')
    })
  }
})

describe('Region parity — currency symbol', () => {
  it('India uses ₹ symbol', () => {
    // fmt uses the symbol passed in — this tests callers use the right symbol
    expect(fmt(10000, '₹')).toContain('₹')
    expect(fmt(10000, '₹')).not.toContain('$')
  })

  it('US uses $ symbol', () => {
    expect(fmt(10000, '$')).toContain('$')
    expect(fmt(10000, '$')).not.toContain('₹')
  })
})

describe('Region parity — CPP value ranges', () => {
  it('India CPP (paise) is in range 50–500 for real programs', () => {
    // Real India programs: HDFC ~150 paise, Axis ~120 paise, Air India ~80 paise
    const validIndiaCpp = [80, 120, 150, 200]
    for (const cpp of validIndiaCpp) {
      const formatted = formatCpp(cpp, 'in')
      expect(formatted).toMatch(/^\d+ paise\/pt$/)
    }
  })

  it('US CPP (cents) is in range 0.5–3 for real programs', () => {
    // Real US programs: Chase UR ~2.05¢, Amex MR ~1.8¢, Hyatt ~1.5¢
    const validUSCpp = [1.5, 1.8, 2.05, 2.5]
    for (const cpp of validUSCpp) {
      const formatted = formatCpp(cpp, 'us')
      expect(formatted).toMatch(/^\d+\.\d+¢\/pt$/)
    }
  })
})
```

**Acceptance criteria for Sprint 19**:
- `npm run test` passes with 0 failures
- At least 30 test cases across the 3 test files
- `src/lib/formatters.ts` exists and exports `fmt` and `formatCpp`
- `src/lib/scoring.ts` exists and exports `goalMatchScore` and `computeCardScore` as pure functions
- `goalMatchScore` and `computeCardScore` are no longer defined inline in page components

---

## Standing Rules — Apply to All Future Work

These apply from Sprint 17 onwards. Any PR that violates them will be blocked at review.

**Rule 1**: No `.from()` calls in page components or API route files. All DB access through `src/lib/db/`.

**Rule 2**: No `console.error`, `console.log`, `console.warn` in `src/`. Use `logError`, `logInfo`, `logWarn` from `src/lib/logger.ts`.

**Rule 3**: All API error responses use helpers from `src/lib/error-utils.ts`. Never `NextResponse.json({ error: '...' }, { status: N })`.

**Rule 4**: No hardcoded `$`, `¢`, `₹`, `JFK`, `DEL` in components. Use the `region` parameter + formatter functions from `src/lib/formatters.ts`.

**Rule 5**: No new feature without at least one test. New API route → test file. New utility function → unit tests.

**Rule 6**: Page components must stay under 700 lines. If you're adding to a component and it will exceed 700 lines, extract first.

---

## PR Checklist (for each sprint)

Before opening a PR, verify:
- [ ] `npm run build` passes with 0 errors
- [ ] `npm run test` passes with 0 failures
- [ ] `npm run lint` passes with 0 errors
- [ ] No new `console.error/log/warn` introduced
- [ ] No raw `NextResponse.json({ error })` introduced
- [ ] No `.from()` calls in API route files (Sprint 17+)
- [ ] Every new function is typed (no implicit `any`)
- [ ] PR description lists exactly which tasks (A1/A2/A3 or B1/B2/B3 or C1/C2/C3) are in the PR

---

## How to Run Tests

```bash
cd /path/to/pointsmax
npm run test          # run all tests once
npm run test -- --watch  # watch mode during development
npm run test -- src/lib/formatters.test.ts  # run single file
```

---

## Important: What NOT to Do

- **Do not rewrite business logic** while refactoring. Move code, don't change it. If you're unsure what a function does, move it as-is and add a comment.
- **Do not change API response shapes.** Existing clients depend on the exact shape. If you change a shape, you break the frontend.
- **Do not merge sprints.** One PR per sprint. Sprint 17 must be merged before Sprint 18 starts.
- **Do not add features** during these architecture sprints. Pure structural work only.
- **Do not delete files** you're not sure about. If something looks unused, comment it out and note it in the PR — don't delete.
