# 04 PR Review Checklist

## Definition of Done
- Feature/bug behavior matches acceptance criteria.
- Required tests are added/updated and pass.
- CI quality gates pass.
- No architecture boundary violations.
- No hardcoded mutable business constants in routes/pages.

## Reviewer Reject Criteria
Reject PR if any condition is true:
- Introduces new `any` without waiver.
- Changes behavior but does not update tests.
- Adds hardcoded production URLs/config in feature code.
- Violates feature boundary import rules.
- Includes unrelated changes beyond declared scope.

## Required PR Metadata
PR description must include:
- architecture impact
- test mapping to acceptance criteria
- hardcode/config impact
- rollout/rollback notes (if operational risk)

## Risk Review
- Security/privacy implications reviewed.
- Rate-limit and payload-limit considerations covered for heavy endpoints.
- Error handling is client-safe and observable server-side.

## Merge Readiness
- Reviewer can explain what changed and why in 3–5 bullets.
- Owner confirms no known blockers remain.
