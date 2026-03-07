# Card Recommender V2 Story Map

## Purpose

This file converts the Card Recommender V2 technical audit into execution-ready
stories for the agent workflow. The goal is to replace the current page-local
ranking demo with a tested, region-aware, wallet-aware recommendation engine.

Current gap summary:

- Ranking logic is UI-bound and hard to test.
- Eligibility and issuer rules are missing.
- Goal matching is too coarse.
- Soft-benefit valuation is hardcoded in page code.
- Recommendation output is not explainable enough for user trust.
- The feature does not yet use wallet balances strongly enough.

## Epic

Epic: Card Recommender V2

Outcome:

- Recommendations are explainable, region-aware, and grounded in eligibility.
- Logic is moved out of the page into a reusable feature slice.
- Ranking behavior is regression-tested.
- Output supports "best next card" and "progress to goal" use cases.

## Delivery Order

1. CR2-S1: Extract scorer domain engine from UI
2. CR2-S2: Add typed input and output contracts
3. CR2-S3: Add issuer and eligibility rule layer
4. CR2-S4: Normalize soft benefits into structured config/data
5. CR2-S5: Add explanation payload and UI rendering
6. CR2-S6: Add wallet-aware next-best-card mode
7. CR2-S7: Add time-to-goal estimator
8. CR2-S8: Add regression and contract test coverage

## Stories

### CR2-S1: Extract scorer domain engine from UI

Goal:

- Move card scoring, goal matching, and ranking out of
  `src/app/[region]/card-recommender/page.tsx`
- Create a reusable feature module under
  `src/features/card-recommender/`

Acceptance:

- Page component becomes orchestration/UI only
- Scoring logic is testable as pure functions
- No behavior regression in current visible output except where later stories intentionally change it

### CR2-S2: Add typed recommendation contracts

Goal:

- Introduce explicit input and result schemas for the recommender

Acceptance:

- Typed input includes region, spend profile, owned cards, goals, and fee tolerance
- Typed result includes rank, reasons, assumptions, and warnings
- UI uses these contracts instead of ad hoc object shapes

### CR2-S3: Add issuer and eligibility rule layer

Goal:

- Prevent obviously ineligible cards from ranking as best options

Acceptance:

- Rule engine supports issuer-specific disqualifiers/tag-based checks
- Results can mark cards as ineligible or low-confidence
- Recommendation output explains disqualification reason

### CR2-S4: Normalize soft benefits

Goal:

- Remove fuzzy card-name matching for perks/benefit uplift

Acceptance:

- Soft benefits move to structured metadata/config
- UI/page code no longer contains card-name string matching for benefit valuation
- Regional cards can declare benefit flags cleanly

### CR2-S5: Add explanation payload and UI

Goal:

- Every recommendation should explain itself in a trustworthy way

Acceptance:

- Output includes "why this card", key assumptions, and tradeoffs
- UI renders reasons without overwhelming the user
- Affiliate disclosure remains visible and separate from ranking logic

### CR2-S6: Add wallet-aware next-best-card mode

Goal:

- Use user balances and target intent to recommend the next most useful card

Acceptance:

- Engine can use existing balances and target program/goal
- Output clearly distinguishes "best first-year value" from "best next card for your wallet"
- Recommendation logic is region-safe

### CR2-S7: Add time-to-goal estimator

Goal:

- Show how quickly a card moves the user toward a stated goal

Acceptance:

- Result can estimate progress/time toward target points
- UI explains that the estimate depends on spend and bonus assumptions
- Zero/low-spend and already-met-goal cases are handled cleanly

### CR2-S8: Add regression and contract tests

Goal:

- Make ranking behavior safe to evolve

Acceptance:

- Domain-level scorer tests cover ordering and explanation output
- Rule/eligibility tests cover disqualifier scenarios
- UI tests verify key explanation surfaces and mode switching

## Agent Assignment

Primary owner: `kimi`

Reason:

- This is a multi-file refactor plus test-backed behavior work.
- The work is clearer if split into narrow stories with strict acceptance criteria.

## Workflow Requirements

- Run Kimi through the PTY wrapper in `scripts/agents/run-kimi-pty.sh`
- Use supervisor mode for async execution and retry visibility
- Review each story independently before promoting it to `done`

## Review Gate

No story is complete unless all of the following are true:

- `npm run lint`
- `npm run test -- --run`
- `npm run build`
- New or updated tests cover the acceptance criteria of that story
