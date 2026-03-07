# Card Recommender V2 Decision Engine Spec

## Purpose

This document specifies the deterministic scoring engine for Card Recommender V2.
It is the engineering contract behind the PRD in
`Documentation/card-recommender-v2-prd.md`.

## Design Constraints

- deterministic and testable
- region-aware
- no hidden weights in page code
- no stringly-typed card-name heuristics for core logic
- hard eligibility rules must run before ranking
- explanations must be produced from the same underlying score inputs

## Current Code Baseline

Current extracted logic lives under:

- `src/features/card-recommender/domain/scorer.ts`
- `src/features/card-recommender/application/use-card-scorer.ts`

Current limitations:

- score is still dominated by first-year value,
- goal matching is coarse,
- soft benefits are card-name mapped,
- eligibility is missing,
- wallet influence is limited,
- explanation payload is shallow.

## Engine Overview

The engine should evaluate candidates in five stages:

1. Candidate selection
2. Hard eligibility filtering
3. Score component calculation
4. Mode-specific weighting
5. Explanation and confidence generation

## Candidate Selection

Candidate set must be limited to:

- active cards,
- cards valid for the current region,
- cards with sufficient pricing / earn data to score,
- cards allowed by product visibility rules.

Excluded candidates should be omitted before scoring if:

- missing essential earn/fee metadata,
- wrong geography,
- inactive or deprecated,
- application URL intentionally disabled.

## Input Contract

Recommended TypeScript contract:

```ts
export interface RecommendationInput {
  region: 'us' | 'in'
  mode: 'next_best_card' | 'long_term_value'
  spendProfile: Partial<Record<SpendCategory, number>>
  goals: TravelGoalKey[]
  ownedCardIds: string[]
  annualFeeTolerance: 'low' | 'medium' | 'high'
  recentApplications?: {
    last24Months?: number
    issuerCounts?: Partial<Record<string, number>>
  }
  wallet?: {
    balances: Array<{
      programId: string
      balance: number
      source?: string
      asOf?: string | null
    }>
  }
}
```

## Candidate Metadata Requirements

Each card should eventually expose:

- issuer
- program / program slug
- geography
- annual fee and currency
- earn rates
- signup bonus
- earn unit
- application URL
- structured soft benefit flags
- issuer rule tags
- card family tags

## Hard Eligibility Layer

Hard eligibility runs before ranking.

Possible outputs:

- `eligible`
- `ineligible`
- `unknown`

### Hard Rule Categories

1. Region mismatch
2. Already owned and duplicate not allowed
3. Issuer application velocity rule hit
4. Product family restriction
5. Explicit rule tag conflict

### Behavior

- `ineligible` cards should not rank normally
- they may optionally surface in a separate blocked section with explanation
- `unknown` cards stay in ranking but receive lower confidence

## Score Components

The engine should produce normalized component scores, not only one aggregate.

### Components

1. `earnValueScore`
- projected value from category spend

2. `signupBonusScore`
- first-year value from bonus
- zeroed or reduced if user already holds card or bonus not realistically eligible

3. `softBenefitScore`
- value from structured benefit flags
- must not rely on name matching

4. `goalAlignmentScore`
- how well the card supports stated user goals
- should use program characteristics, not only string tag overlap

5. `walletSynergyScore`
- how much the card helps the current wallet
- stronger in `next_best_card` mode

6. `feePenaltyScore`
- annual fee drag adjusted by user fee tolerance

7. `complexityPenaltyScore`
- penalize cards whose value depends on benefits or behaviors the user is unlikely to use

### Aggregate Output

Recommended internal shape:

```ts
export interface RecommendationScoreBreakdown {
  earnValueScore: number
  signupBonusScore: number
  softBenefitScore: number
  goalAlignmentScore: number
  walletSynergyScore: number
  feePenaltyScore: number
  complexityPenaltyScore: number
}
```

## Mode-Specific Weighting

### `long_term_value`

Bias toward:

- sustainable annual value
- realistic ongoing rewards
- lower complexity

Less weight on:

- one-time bonus spikes

### `next_best_card`

Bias toward:

- current wallet gaps
- immediate usefulness
- goal acceleration
- issuer timing opportunity

## Confidence Model

Confidence should not be a vague percentage. It should be derived from explicit factors.

Recommended factors:

1. data completeness
2. freshness of wallet inputs
3. certainty of issuer-rule evaluation
4. certainty of benefit metadata
5. strength of goal match

Suggested output:

```ts
export interface RecommendationConfidence {
  level: 'high' | 'medium' | 'low'
  score: number
  reasons: string[]
}
```

## Explanation Model

Explanation must be generated from score components and rule outcomes.

Recommended output:

```ts
export interface RecommendationExplanation {
  whyThisCard: string[]
  whyNow?: string[]
  assumptions: string[]
  warnings: string[]
}
```

Rules:

- no generic AI filler
- every explanation line must map to an actual model factor
- warnings must surface uncertainty, not hide it

## Result Contract

Recommended result shape:

```ts
export interface RecommendationResult {
  cardId: string
  rank: number
  mode: 'next_best_card' | 'long_term_value'
  status: 'eligible' | 'ineligible' | 'unknown'
  totalScore: number
  firstYearValue: number
  ongoingValue: number
  breakdown: RecommendationScoreBreakdown
  confidence: RecommendationConfidence
  explanation: RecommendationExplanation
}
```

## Rule Precedence

The following order must be enforced:

1. geography/product visibility
2. hard ineligibility rules
3. score components
4. mode weighting
5. confidence generation
6. explanation rendering

Do not generate recommendation copy before eligibility and confidence are known.

## Tie-Breaking

If `totalScore` ties:

1. higher confidence
2. higher goal alignment
3. lower fee drag
4. lower complexity penalty
5. deterministic stable fallback by card id

## Test Requirements

Required test categories:

1. hard rule gating
2. stable ordering for representative US scenarios
3. stable ordering for representative India scenarios
4. explanation generation from score inputs
5. confidence downgrade when data/rules are incomplete
6. wallet-aware mode behavior
7. zero/low-spend edge cases

## Migration Notes

To move from current scorer to V2:

1. keep existing `scoreAndRankCards()` as baseline behavior guard
2. introduce a new V2 scorer contract behind tests
3. migrate page to V2 output once explanation + confidence are ready
4. remove page-level heuristics only after parity/regression tests pass
