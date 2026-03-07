# Card Recommender V2 Delivery Plan

## Summary

This document converts the V2 PRD and decision engine spec into implementation
phases.

Reference documents:

- `Documentation/card-recommender-v2-prd.md`
- `Documentation/card-recommender-v2-decision-engine-spec.md`
- `Documentation/card-recommender-v2-story-map.md`

## Delivery Strategy

Build V2 in layers:

1. engine correctness
2. contracts
3. rule safety
4. explanation/trust layer
5. wallet-aware enhancement
6. UI refinement

Do not start with UI polish. The moat is in correct ranking behavior and trusted
explanations.

## Execution Phases

### Phase 1: Core Engine Stabilization

Scope:

- extract scoring engine from UI
- add typed contracts
- preserve current behavior while making the engine testable

Recommended implementation shape:

- land the scorer and contracts first
- keep UI behavior stable while moving logic into the feature slice

## Phase 2: Rule Safety + Structured Data

Scope:

- issuer and eligibility layer
- structured soft benefits
- remove brittle page heuristics

Recommended implementation shape:

- keep rule logic independent from UI rendering
- add explicit ineligible/low-confidence outputs before surfacing warnings in UI

## Phase 3: Explainability Layer

Scope:

- explanation payload
- assumptions and warnings
- confidence model
- initial UI rendering

Recommended implementation shape:

- finalize the explanation payload first
- then render reasons and warnings in the page shell

## Phase 4: Wallet-Aware Upgrade

Scope:

- next-best-card mode
- wallet balance input use
- goal acceleration logic

Recommended implementation shape:

- gate wallet-aware ranking behind deterministic tests
- keep mode-specific ranking clearly separated from long-term value ranking

## Phase 5: Time-to-Goal + Regression Safety

Scope:

- time-to-goal estimator
- ranking regression suite

Recommended implementation shape:

- add scenario tests before exposing the time-to-goal UI
- protect ranking order with regression fixtures

## Review Rules

Every story must be reviewed against:

1. product intent
2. correctness of rule handling
3. explanation quality
4. test adequacy
5. region safety

## Acceptance Criteria By Phase

### Phase 1 complete when:

- page-level ranking logic is no longer the core engine
- typed contracts exist
- regression tests preserve current baseline behavior

### Phase 2 complete when:

- obvious ineligible cards are not recommended as top choices
- soft benefits no longer depend on card-name string matching

### Phase 3 complete when:

- every top recommendation explains itself
- confidence and warnings are visible and defensible

### Phase 4 complete when:

- next-best-card mode meaningfully differs from long-term-value mode
- wallet balances influence output in test-covered scenarios

### Phase 5 complete when:

- ranking changes are protected by robust scenario tests
- time-to-goal estimates are conservative and understandable

## Recommended Immediate Action

1. finish the scorer/domain extraction
2. lock the API contracts with tests
3. add rule safety before any major UI polish
4. only then ship the richer explanation layer
