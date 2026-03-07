# Card Recommender V2 PRD

## Summary

Card Recommender V2 turns the current ranking demo into a wallet-aware,
issuer-rule-aware recommendation product that tells users:

- what card to get next,
- why it is being recommended,
- how confident the system is,
- what tradeoffs exist,
- and what action to take now.

This is not an "AI recommends a card" feature. The core engine is deterministic,
testable scoring logic with explainable outputs. AI can assist onboarding and
copy, but not core ranking decisions.

## Product Thesis

Users do not want a generic "best travel cards" list. They want a system that
understands:

- what they already hold,
- what they spend on,
- which issuers may reject them,
- what goal they are trying to reach,
- and whether the recommendation is still worth trusting.

PointsMax wins if the recommender is:

1. accurate,
2. explainable,
3. actionable,
4. region-aware,
5. wallet-aware.

## Users

Primary users:

- Individual consumers
- Couples and families planning together
- Users optimizing either India or US card portfolios

Primary user intents:

- "What card should I get next?"
- "Which card is best for my spending?"
- "Which card gets me to my travel goal fastest?"
- "Should I keep, cancel, or downgrade a card I already have?"

## Problems To Solve

Current gaps in the live product:

- recommendations are still heavily first-year-value driven,
- issuer restrictions are not modeled,
- soft benefits rely on brittle card-name mapping,
- wallet context is underused,
- explanations are too thin for trust,
- recommendation logic is not yet complete enough to be a product moat.

Market gaps to exploit:

- competitors are either generic, opaque, or unreliable,
- India has high under-optimization and low tool adoption,
- US users have tools but still lack trusted wallet-aware advice.

## Product Principles

1. Accuracy before intelligence
2. Explainability before persuasion
3. Actionability before content
4. Wallet context is the moat
5. India is first-class, not an afterthought

## Goals

### Business Goals

- Increase trust and differentiation for PointsMax
- Improve affiliate conversion quality from recommender traffic
- Build a reusable decision engine that can later power AI advice and trip flows

### User Goals

- Reduce recommendation paralysis
- Provide a believable next best action
- Avoid obviously bad or ineligible recommendations
- Make value and tradeoffs easy to understand

## Non-Goals

V2 should not attempt:

- a fully AI-driven ranking engine,
- full automated wallet sync dependency,
- complex household/P2 orchestration in MVP,
- advanced retention offer optimization,
- exhaustive airline redemption simulation inside the recommender itself.

Those can follow after the deterministic core is trusted.

## V2 Modes

MVP should support exactly two visible modes:

1. `Best Next Card`
2. `Best Long-Term Value`

Phase 2 modes:

- `Trip Goal Mode`
- `Keep vs Cancel vs Product Change`
- `Household Mode`

## MVP Scope

### Inputs

- region
- monthly spend by major category
- owned cards
- annual fee tolerance
- high-level travel/cashback goals
- recent applications / issuer restriction signals
- optional wallet balances where available

### Recommendation Output

Each recommendation must include:

- card identity
- rank
- net first-year value
- ongoing value signal
- why this card
- why now
- assumptions
- warnings or disqualifiers
- confidence score
- affiliate disclosure separate from ranking logic

### Trust Layer

- freshness/source metadata where relevant
- explicit confidence score
- visible disqualification logic
- non-black-box reasoning

## UX Requirements

### Intake

- keep the initial input set small
- do not require 20+ categories to get useful output
- use progressive disclosure for advanced inputs

### Recommendation Cards

- show the top recommendation clearly
- explain reasoning in plain language
- allow side-by-side comparison for top options
- surface ineligible or low-confidence cards with explanation, not silent removal

### Actionability

- every top result should imply a next step
- "Apply now" remains a separate monetization/control layer
- timing-sensitive guidance must be clearly labeled as assumption-based if not verified

## Rollout Plan

### Phase 1

- deterministic engine refactor
- typed contracts
- issuer rule gating
- explanation payload
- stable regression tests

### Phase 2

- wallet-aware next-best-card mode
- time-to-goal estimator
- richer explanation UI

### Phase 3

- trip-goal mode
- household mode
- keep/cancel/product-change workflows

## Success Metrics

Primary metrics:

- recommendation CTR to detail/apply action
- recommendation-to-apply click conversion
- explanation expand rate
- completion rate of intake flow
- percentage of users who return after first recommendation session

Trust metrics:

- recommendation feedback accuracy score
- support complaints tied to wrong recommendations
- manual override / "this is wrong" rate

Quality metrics:

- regression test pass rate for ranking scenarios
- stale or low-confidence recommendation share
- percentage of recommendations blocked by issuer-rule logic

## Launch Criteria

Card Recommender V2 is launch-ready when:

- deterministic scorer is the single ranking source of truth,
- top recommendations are explainable,
- issuer rule layer blocks obvious bad recommendations,
- tests cover representative US and India ranking cases,
- current page-level heuristics are no longer the decision engine.
