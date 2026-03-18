# PointsMax Agent Assignments

This document assigns the remaining Q2 broad-launch work to concrete subagents so open launch items have owners, scope, and output targets.

## Active Assignments

### Agent 3: Region parity and route completeness

- Tracker items: `LH-011`
- Scope:
  - `src/app/[region]/**`
  - `src/app/*.tsx` route aliases
  - `src/lib/regions*`
  - `src/app/api/programs*`
- Deliverables:
  - Audit US vs India route parity
  - Identify missing or misleading regional copy/data
  - Propose or implement the highest-value fixes without touching unrelated launch tracks
- Output file:
  - `Documentation/implementation/agent-reports/lh-011-region-parity.md`

### Agent 4: Card, content, and workflow linkage

- Tracker items: `LH-012`
- Scope:
  - `src/app/[region]/cards/**`
  - `src/app/[region]/programs/**`
  - `src/app/[region]/card-recommender/**`
  - `src/lib/programmatic-content*`
- Deliverables:
  - Map where card/program/content surfaces fail to connect into booking workflows
  - Recommend or implement the highest-value linkage improvements
  - Keep changes scoped away from release engineering and wallet/search trust-state work
- Output file:
  - `Documentation/implementation/agent-reports/lh-012-card-content-linkage.md`

### Agent 5: Release engineering and launch gates

- Tracker items: `LH-010`
- Scope:
  - `scripts/**`
  - `package.json`
  - launch-tracker docs
- Deliverables:
  - Make launch-candidate checks objective and repeatable
  - Improve route truthfulness checks and smoke coverage
  - Keep verification easy to run locally before public launch
- Output file:
  - `Documentation/implementation/agent-reports/lh-010-release-gates.md`

### Agent 6: GTM, SEO, and distribution

- Tracker items: `LH-013`
- Scope:
  - `Documentation/**`
  - public marketing surfaces for analysis
- Deliverables:
  - Convert the product wedge into a concrete public-launch distribution plan
  - Separate what should be SEO, creator-led, affiliate-led, or community-led
  - Ground recommendations in the current product surfaces instead of generic advice
- Output file:
  - `Documentation/implementation/agent-reports/lh-013-gtm.md`

## Coordination Rules

- Each agent should stay inside its scoped files or output document.
- Cross-track conflicts should be written up, not solved by broad edits.
- Every output must end with:
  - completed work
  - open blockers
  - recommended next edits
