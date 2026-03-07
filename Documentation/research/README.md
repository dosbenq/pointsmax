# Research Workspace

This folder is the system of record for product discovery, market research, and strategy decisions.

## Purpose
- Keep evidence separate from opinions.
- Make assumptions explicit and testable.
- Preserve decision history so future PMs can understand why choices were made.
- Connect market insight directly to build priorities.

## Workflow (Use This Order)
1. Define focus and scope in `00-research-charter.md`.
2. Capture raw evidence in `01-evidence-log.md` with links.
3. Synthesize user jobs and pain points in `02-user-jtbd.md`.
4. Map unmet needs and whitespace in `03-gap-opportunity-map.md`.
5. Convert assumptions into tests in `04-hypothesis-experiment-tracker.md`.
6. Rank candidate features in `05-feature-prioritization-rice.md`.
7. Record final choices in `06-decision-log.md`.
8. Convert approved bets into implementation scope in `10-connected-wallet-epic.md`.

## Update Rule
Update this folder after every research session and after every major product decision.

Minimum required update:
- one new row in `01-evidence-log.md`
- one updated hypothesis or experiment status in `04-hypothesis-experiment-tracker.md`
- one decision entry in `06-decision-log.md` when roadmap changes

## Evidence Standard
- Every major claim must reference at least one source URL.
- Mark each conclusion as:
  - `Fact` (directly evidenced)
  - `Inference` (reasoned from evidence)
  - `Assumption` (untested)

## Naming Convention
- Date format: `YYYY-MM-DD`
- Use concise IDs in tables (for example: `E-014`, `H-007`, `D-003`).
