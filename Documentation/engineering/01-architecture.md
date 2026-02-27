# 01 Architecture

## Goal
Build a scalable, agent-friendly codebase where frontend redesigns do not break backend logic and feature teams can work in parallel.

## Vertical Slice Standard
All net-new or refactored product logic must live in feature slices:

- `src/features/<feature>/ui/`
- `src/features/<feature>/application/`
- `src/features/<feature>/domain/`
- `src/features/<feature>/infrastructure/`
- `src/features/<feature>/__tests__/`
- `src/features/<feature>/index.ts`

## Layer Responsibilities
- `ui`: render-only components and presentation hooks.
- `application`: use-cases, orchestration, command/query handlers.
- `domain`: pure business rules, domain types, deterministic transforms.
- `infrastructure`: external integrations (DB/API/analytics/cache).

## Dependency Rules
Allowed dependency direction:

- `ui -> application -> domain`
- `infrastructure -> domain`
- `ui -> domain` (read-only domain types/helpers)

Disallowed:

- `domain -> application|ui|infrastructure`
- `application -> ui`
- `app/*` importing feature internals (`@/features/<x>/ui/*`, etc)
- feature-to-feature internal imports (`@/features/<x>/domain/*` from other features)

Cross-feature imports must use public APIs only:

- Allowed: `@/features/<feature>`
- Disallowed: `@/features/<feature>/internal/path`

## Entrypoint Boundaries
- `src/app/**`: route/page wiring only.
- `src/app/api/**`: transport adapters only.
- Business logic should be delegated to `src/features/**` or `src/lib/**` domain modules.

## Anti-patterns
- Route handlers with embedded decision logic spanning multiple domains.
- UI components calling DB/API clients directly.
- Shared mutable constants duplicated across routes/pages.
- Feature code reading process env directly (except explicit infrastructure adapters).

## Migration Policy
- Pilot-first migration: refactor one feature at a time.
- No big-bang rewrite.
- Preserve behavior with parity tests before and after migration.

## Review Checklist
- Is logic placed in the correct slice layer?
- Are imports using public feature APIs only?
- Can this module be unit tested without network/DB?

## See Also
- [02 Coding Standards](./02-coding-standards.md) - TypeScript and code quality standards
- [03 Testing Strategy](./03-testing-strategy.md) - Testing pyramid and quality gates
- [04 PR Review Checklist](./04-pr-review-checklist.md) - PR review requirements and criteria
