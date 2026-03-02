# Hypothesis and Experiment Tracker

| Hypothesis ID | Hypothesis | Metric | Baseline | Target | Experiment Design | Owner | Status | Result | Decision Link |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H-001 | Showing explicit "points needed from your wallet" will improve conversion to booking actions | CTA click-through rate | TBD | +20% | A/B test on action strip and recommendation cards | PM | Planned | TBD | D-001 |
| H-002 | Grounded AI responses with citations and confidence labels increase helpfulness and reduce distrust | Helpful response rate; user-reported trust | TBD | Helpful rate >= 70%, trust complaints < 5% | A/B test between citation-enforced and standard response templates | PM + AI | Planned | TBD | D-002 |
| H-003 | Adding transfer+booking step guidance to top results reduces drop-off after search | Search-to-book-action conversion | TBD | +25% | Funnel experiment on result cards with execution strip vs control | PM + Eng | Planned | TBD | D-002 |
| H-004 | Freshness labels on recommendations reduce support tickets about stale data | Ticket rate per 1,000 AI responses | TBD | -30% | Roll out freshness metadata in AI answers and compare cohorts | PM + Support | Planned | TBD | D-002 |
| H-005 | Connected account auto-sync increases activation vs manual-only balance entry | Wallet setup completion rate | TBD | +35% | Cohort test: connected-wallet onboarding vs manual entry flow | PM + Eng | Planned | TBD | D-003 |

## Status Values
- `Planned`
- `Running`
- `Completed`
- `Invalidated`
- `Rolled into roadmap`

## Rules
- Every roadmap item above `P1` must map to at least one hypothesis.
- Close experiments with a clear decision in `06-decision-log.md`.
