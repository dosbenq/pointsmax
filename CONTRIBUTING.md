# Contributing to PointsMax

## Engineering Constitution

Before contributing, read the engineering constitution:

- [`Documentation/engineering/01-architecture.md`](./Documentation/engineering/01-architecture.md) - Architecture boundaries and vertical slice standards
- [`Documentation/engineering/02-coding-standards.md`](./Documentation/engineering/02-coding-standards.md) - TypeScript and coding conventions
- [`Documentation/engineering/03-testing-strategy.md`](./Documentation/engineering/03-testing-strategy.md) - Required tests by change type
- [`Documentation/engineering/04-pr-review-checklist.md`](./Documentation/engineering/04-pr-review-checklist.md) - Review criteria and reject conditions
- [`Documentation/engineering/05-agent-contribution-contract.md`](./Documentation/engineering/05-agent-contribution-contract.md) - Task and output format requirements
- [`Documentation/engineering/06-release-quality-gates.md`](./Documentation/engineering/06-release-quality-gates.md) - CI quality gates and branch protection

## Contribution Workflow

1. Create a scoped task with acceptance criteria and required tests.
2. Implement only in declared scope.
3. Run required validation commands.
4. Open PR with required metadata.

## Required Local Checks

Run these checks before submitting a PR:

```bash
# Core quality checks
npm run lint
npx tsc --noEmit
npm run test -- --run
npm run build

# Dossier verification (regenerate if product changes)
npm run pm:dossier:sync
npm run pm:dossier:check

# Run all quality gates
npm run quality:gates
```

## Architecture and Quality Rules

- Use vertical slices for net-new/refactored feature code.
- No hardcoded mutable business config in routes/pages.
- No `any` without explicit waiver.
- Behavior changes require test changes.

## Reject Criteria Summary

PRs will be rejected if any of the following conditions are true:

| Violation | Description |
|-----------|-------------|
| New `any` without waiver | Introduces `any` type without explicit waiver |
| Behavior without tests | Changes behavior but does not update tests |
| Hardcoded production config | Adds hardcoded production URLs/config in feature code |
| Boundary violations | Violates feature boundary import rules |
| Scope creep | Includes unrelated changes beyond declared scope |

## PR Requirements

- Use the repository PR template and fill all mandatory sections.
- PR description must include: architecture impact, test mapping to acceptance criteria, hardcode/config impact, rollout/rollback notes (if operational risk).
- Reviewers may reject PRs that violate checklist rules.
- If your change touched product behavior, APIs, schema, workflows, or env vars, regenerate `Documentation/PM_PROJECT_DOSSIER.md`.

## Reviewer Notes

Reviewers verify:
- Feature/bug behavior matches acceptance criteria
- Required tests are added/updated and pass
- CI quality gates pass
- No architecture boundary violations
- No hardcoded mutable business constants in routes/pages

A task can move to `done` only after human review confirms acceptance criteria, local/CI checks pass, and no boundary/policy violations remain.
