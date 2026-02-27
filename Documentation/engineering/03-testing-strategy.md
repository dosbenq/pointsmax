# 03 Testing Strategy

## Testing Objective
Catch regressions early while keeping tests deterministic and actionable.

## Test Pyramid
- Unit tests (majority): pure domain/application logic.
- API contract tests: route input/output behavior and failure modes.
- Component tests: interactive UI behavior and rendering states.
- Smoke tests: critical path validation in built runtime.

## Required Tests by Change Type
- Changes under `src/app/api/**`: at least one API route test must change/add.
- Changes under `src/features/**/ui/**`: at least one component test must change/add.
- Any behavior change in `src/**` production code: at least one relevant test must change/add.

## Deterministic Rules
- Freeze time/randomness where used.
- Mock network/provider dependencies.
- Avoid environment-dependent assertions.
- Keep snapshots minimal and intentional.

## Fixtures and Mocks
- Use reusable deterministic fixtures in shared test utilities.
- Prefer narrow mocks over global over-mocking.
- Validate both success and failure paths.

## Quality Gates
CI must pass:
- lint
- typecheck
- unit/API/component tests
- build
- smoke checks

## Flaky Test Protocol
- Mark and isolate flaky tests immediately.
- Fix root cause before merge when possible.
- If temporary quarantine is required, file a tracked follow-up task.
