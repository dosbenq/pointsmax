# Remaining Execution Handoff

Last updated: 2026-03-06
Branch currently checked out in working repo: `ui/inner-page-redesign`

## Purpose
This document captures the exact remaining work after the UI branch review/repair pass so another engineer can continue execution without reconstructing context.

It is intentionally operational, not aspirational:
- what is already done
- what is still incomplete
- where the code lives
- what order to execute
- what to verify before considering the work finished

## Current Verified State

### Verified good
- The `ui/inner-page-redesign` branch was repaired and validated.
- The following commands passed in `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax`:
  - `npm run lint`
  - `npm run test -- --run`
  - `npm run build`
- The branch includes:
  - connected wallet UI surface
  - `/api/connectors` collection route
  - `/api/connectors/[id]/balances`
  - CSV/email ingestion baseline
  - profile region query-parameter support
  - connector provider contract alignment

### Local git state
- Latest feature branch commit:
  - `ccab1a8` `Finalize connected wallet UI and connector flows`
- Local merge commit created in a clean worktree:
  - `66be168` `Merge branch 'ui/inner-page-redesign'`

### Important constraint
- `main` was merged locally in a clean worktree, but the push to GitHub failed because the environment could not resolve `github.com`.
- That means:
  - feature branch remote is updated
  - remote `main` is not yet updated from this environment

## Remaining Issues

### 1. Push merged `main` to GitHub
Severity: High
Status: Not completed from this environment

#### Current state
- Clean merge exists locally in `/tmp/pointsmax-merge`
- Merge commit: `66be168`

#### Required action
Run from a network-enabled environment:

```bash
git -C /tmp/pointsmax-merge push origin main
```

If `/tmp/pointsmax-merge` no longer exists, recreate from the main repository:

```bash
rm -rf /tmp/pointsmax-merge
git -C /Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax worktree add /tmp/pointsmax-merge main
cd /tmp/pointsmax-merge
git merge --no-ff ui/inner-page-redesign
git push origin main
```

#### Acceptance criteria
- `origin/main` contains merge commit `66be168` or an equivalent merge commit including `ccab1a8`
- GitHub default branch reflects the repaired UI and connected wallet work

## 2. Merge synced balances into the core product path
Severity: High
Status: Still incomplete

### Problem
Connected wallet snapshots exist, but the main balance API used by calculator, trip-builder, inspire, and award search still primarily serves manual `user_balances`.

### Relevant files
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/api/user/balances/route.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/[region]/calculator/hooks/use-calculator-state.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/[region]/trip-builder/page.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/[region]/inspire/page.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/[region]/award-search/page.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/api/connectors/[id]/balances/route.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/types/connectors.ts`

### Required behavior
- `GET /api/user/balances` should return a unified wallet view:
  - manual balances
  - latest synced balances from `balance_snapshots`
  - freshness/trust metadata for connected balances
- The response should make source explicit instead of silently mixing data.

### Recommended implementation
1. Add a unified response shape in `/src/app/api/user/balances/route.ts`:
   - `program_id`
   - `balance`
   - `source`
   - `as_of`
   - `confidence`
   - `sync_status`
   - `is_stale`
   - `connected_account_id` when applicable
2. For each connected account:
   - query latest snapshot per `program_id`
   - compute freshness from `fetched_at`
   - compute `is_stale` using the same sync stale threshold used by connector sync policy
3. Decide precedence rule:
   - safest default: manual entries override connected snapshots when both exist for same `program_id`
   - include duplicate-source metadata only if UI can explain it
4. Update clients to tolerate the richer shape without breaking existing calculations.

### Tests required
- unit/integration tests for `/api/user/balances`
- verify calculator autoloads connected balances
- verify trip builder sees connected balances
- verify region filtering still works
- verify manual-only users still get unchanged behavior

### Acceptance criteria
- A user with synced connected balances sees them inside calculator/trip-builder/inspire without manual entry
- Existing manual balance behavior is preserved
- No route/test regressions

## 3. Replace partial connected wallet flow with a real connect flow or honest gating
Severity: High
Status: Partially improved, still incomplete

### Current state
- `/src/components/ConnectedWallets.tsx` no longer shows a fake "coming soon" alert
- It currently routes to manual entry when invoked from profile
- There is still no real OAuth/connect authorization flow

### Relevant files
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/components/ConnectedWallets.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/profile/page.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/api/connectors/route.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/connectors/connector-registry.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/connectors/adapters/index.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/connectors/adapters/not-implemented.ts`

### Required decision
One of these must happen:

#### Option A: Honest beta gating
- Keep current UI
- Rename CTA to something explicit like `Import balances`
- Remove all language implying live account linking
- Treat connectors as internal scaffolding only

#### Option B: Real first connector
- Implement one real provider auth/connect flow end to end
- Best candidate is a single bank/provider with a stable integration path
- Requires:
  - authorization start route
  - callback route
  - token vault write
  - connector account create/update
  - first sync trigger

Given current codebase maturity, Option A is the faster truthful path unless an actual provider integration is immediately available.

### Acceptance criteria
- No CTA suggests functionality that does not exist
- The user can either truly connect an account or clearly use import/manual fallback

## 4. Convert `/profile` into a first-class region-aware surface
Severity: Medium
Status: Improved but still transitional

### Current state
- `/profile` now accepts `?region=us|in`
- navbar passes `?region=...`
- localStorage persists region as a fallback

### Remaining problem
- This is still a global route with query-param scoping
- It is better than heuristic region detection, but not the clean final architecture

### Relevant files
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/profile/page.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/components/NavBar.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/regions.ts`

### Recommended implementation
Move profile into regional routing:
- create `src/app/[region]/profile/page.tsx`
- update navbar/profile links to `/${region}/profile`
- remove query-param-based region bootstrapping from profile page
- keep a redirect stub at `/profile` only if needed

### Acceptance criteria
- Region is derived from route structure, not client heuristics
- Profile alert programs, connected wallet instructions, and pricing context stay in-region

## 5. Complete ingestion productization
Severity: Medium
Status: Baseline only

### Current state
- CSV ingestion route exists
- Email ingestion route is still placeholder/interest registration

### Relevant files
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/api/connectors/ingest/csv/route.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/api/connectors/ingest/email/route.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/connectors/csv-parser.ts`

### Required work
#### CSV
- connect imported balances into unified user wallet path
- surface import results in UI
- optionally dedupe/import by program rather than piling snapshots without user clarity

#### Email
- either:
  - keep as explicit waitlist-only feature with clearer product copy
  - or build a real ingestion pipeline

The immediate practical improvement is to integrate CSV results into wallet UX and label email ingestion honestly as planned.

### Acceptance criteria
- CSV import has visible downstream effect in product
- Email ingest copy reflects reality

## 6. Implement at least one real connector adapter or hard-disable the adapter promise
Severity: Medium
Status: Not implemented

### Current state
- connector registry and interfaces exist
- built-in adapters are all not-implemented placeholders

### Relevant files
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/connectors/adapters/index.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/connectors/adapters/not-implemented.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/connectors/connector-interface.ts`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/connectors/sync-orchestrator.ts`

### Required action
Choose one:

#### Option A: hard-disable adapter-backed sync in UI/product copy
- present connectors as internal beta
- avoid claiming supported live connections

#### Option B: implement one adapter fully
- credential retrieval
- provider API call
- balance normalization
- sync persistence

### Acceptance criteria
- Product claims align with actual adapter support

## 7. Clean up task metadata and agent noise from the working repo
Severity: Medium
Status: Still dirty in working tree

### Files currently outside the product commit path
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/KIMI_TASKS.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/CONNECTED_WALLETS_UX_NOTES.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0024.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0029.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0030.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0031.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0032.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0033.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0034.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0035.md`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/agents/tasks/TASK-0036.md`

### Required action
- decide whether these belong in version control
- if yes, commit them separately with a tooling/process commit
- if no, remove or ignore them and keep feature branches clean

### Acceptance criteria
- `git status` on the working repo does not contain unrelated orchestration residue when feature work is complete

## Recommended Execution Order
1. Push merged `main`
2. Unify `/api/user/balances`
3. Update product UIs to consume unified balances
4. Decide honest gating vs real connector auth
5. Move profile to `/{region}/profile`
6. Productize CSV import and demote email ingest copy if still placeholder
7. Clean task metadata/worktree noise

## Commands To Re-Run Before Closing The Work

From `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax`:

```bash
npm run lint
npm run test -- --run
npm run build
```

If pushing the merged main branch from the clean worktree:

```bash
git -C /tmp/pointsmax-merge status
git -C /tmp/pointsmax-merge log --oneline -1
git -C /tmp/pointsmax-merge push origin main
```

## Notes For The Next Engineer
- Do not revert unrelated task metadata unless that cleanup is intentional and isolated.
- The feature branch code is already valid; do not re-open the earlier provider mismatch that was fixed in `/api/connectors`.
- The highest-value missing behavior is not more connector UI. It is wiring synced balances into the existing wallet-driven product flows.
