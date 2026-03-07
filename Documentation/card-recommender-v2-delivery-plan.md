# Card Recommender V2 Delivery Plan

## Summary

This document converts the V2 PRD and decision engine spec into implementation
phases, with recommended owner routing by task type.

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

Current mapped stories:

- `TASK-0037`
- `TASK-0038`

Recommended owner:

- `kimi`

Reason:

- best fit for broad refactor + documentation-aligned implementation work

## Phase 2: Rule Safety + Structured Data

Scope:

- issuer and eligibility layer
- structured soft benefits
- remove brittle page heuristics

Current mapped stories:

- `TASK-0039`
- `TASK-0040`

Recommended owner:

- `claude` for rule design if Kimi output is weak
- `kimi` if Phase 1 quality is good enough

Reason:

- this is where product risk becomes logic risk
- if agent quality drops here, move this phase to the strongest reasoning model

## Phase 3: Explainability Layer

Scope:

- explanation payload
- assumptions and warnings
- confidence model
- initial UI rendering

Current mapped stories:

- `TASK-0041`

Recommended owner:

- `gemini` for UI rendering and surface wiring
- `claude` or `kimi` for explanation contract if needed

Reason:

- this phase splits naturally into backend contract work and UI presentation

## Phase 4: Wallet-Aware Upgrade

Scope:

- next-best-card mode
- wallet balance input use
- goal acceleration logic

Current mapped stories:

- `TASK-0042`

Recommended owner:

- `claude`

Reason:

- this is product-critical reasoning logic with higher coupling to wallet inputs and mode behavior

## Phase 5: Time-to-Goal + Regression Safety

Scope:

- time-to-goal estimator
- ranking regression suite

Current mapped stories:

- `TASK-0043`
- `TASK-0044`

Recommended owner:

- `gemini` for test wiring and UI estimator surface
- `claude` for regression design if ordering logic becomes subtle

## Routing Rules

Use these defaults going forward:

### Give to Kimi

- broad multi-file refactors
- story execution against a clear spec
- documentation-aligned architecture cleanup

### Give to Gemini

- UI wiring
- component tests
- deterministic surface updates
- implementation tasks with low ambiguity

### Give to Claude

- eligibility/rule engines
- scoring logic with tricky tradeoffs
- safety-critical ranking changes
- regression-sensitive architecture decisions

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

1. let `TASK-0037` finish
2. review Kimi output against the new PRD/spec, not just raw code diffs
3. if Kimi quality is acceptable, continue through `TASK-0038`
4. before `TASK-0039`, decide whether rule-engine work stays with Kimi or is reassigned to Claude
