# Contributing to PointsMax

## First Read
Before opening a PR, read the engineering constitution:

- `Documentation/engineering/01-architecture.md`
- `Documentation/engineering/02-coding-standards.md`
- `Documentation/engineering/03-testing-strategy.md`
- `Documentation/engineering/04-pr-review-checklist.md`
- `Documentation/engineering/05-agent-contribution-contract.md`
- `Documentation/engineering/06-release-quality-gates.md`

## Workflow
1. Create a scoped task with acceptance criteria and required tests.
2. Implement only in declared scope.
3. Run required validation commands.
4. Open PR with required metadata.

## Required Local Checks
```bash
npm run pm:dossier:sync
npm run lint
npx tsc --noEmit
npm run test -- --run
npm run build
npm run pm:dossier:check
```

## Architecture and Quality Rules
- Use vertical slices for net-new/refactored feature code.
- No hardcoded mutable business config in routes/pages.
- No `any` without explicit waiver.
- Behavior changes require test changes.

## PR Requirements
Use the repository PR template and fill all mandatory sections.
Reviewers may reject PRs that violate checklist rules.
If your change touched product behavior, APIs, schema, workflows, or env vars, regenerate `Documentation/PM_PROJECT_DOSSIER.md`.
