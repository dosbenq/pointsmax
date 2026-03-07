# Feature Prioritization (RICE)

Scoring formula: `RICE = (Reach * Impact * Confidence) / Effort`

| Feature ID | Feature | Reach | Impact (1-3) | Confidence (%) | Effort (person-weeks) | RICE Score | Rationale | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-001 | Expert context ingestion (YouTube + web) with grounded answers | TBD | 3 | 60 | TBD | TBD | Potential trust + differentiation unlock | Discovery |
| F-002 | Real-time availability + booking action flow | TBD | 3 | 70 | TBD | TBD | Core value promise and retention driver | Discovery |
| F-003 | Alerts that map directly to wallet transfer steps | TBD | 2 | 65 | TBD | TBD | Sticky retention + monetization path | Discovery |
| F-004 | Context Intelligence MVP (10 curated sources + citations + confidence labels) | 12000 | 3 | 55 | 4 | 4950 | Establishes differentiation and trust controls | P0 |
| F-005 | Guided transfer and booking strip on top redemption options | 10000 | 3 | 70 | 3 | 7000 | Directly targets execution abandonment | P0 |
| F-006 | Wallet-aware alert explanations ("why this matters for your balance") | 9000 | 2 | 65 | 2 | 5850 | Improves retention and actionability of alerts | P1 |
| F-007 | Freshness and source metadata surfaced in all AI answers | 8000 | 2 | 75 | 2 | 6000 | Reduces trust loss from perceived stale or unsupported claims | P0 |
| F-008 | Connected Wallet (linked accounts + sync + manual fallback) | 11000 | 3 | 60 | 6 | 3300 | Removes onboarding friction and improves recommendation accuracy with direct balance data | P0 |

## Prioritization Bands
- `P0`: immediate execution
- `P1`: next sprint
- `P2`: backlog with validation required
- `P3`: parked

## Notes
- Scores for `F-004` to `F-007` are provisional and derived from early strategy-synthesis assumptions.
- Final scoring must be recalibrated after two weeks of production telemetry.
