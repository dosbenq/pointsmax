# 06 Release Quality Gates

## Mandatory CI Checks
- Lint
- Typecheck
- Unit/API/component tests
- Build
- Smoke checks
- Architecture boundary checks
- Changed-scope test policy checks
- Hardcoded URL/config guard checks
- New `any` guard checks

## Branch Protection Map
Protected branch must require:
- `verify` job
- `quality-gate` aggregate job

No bypass for failing required checks.

## Changed-Scope Policy
If these files change, these test updates are mandatory:
- `src/app/api/**` -> API tests
- `src/features/**/ui/**` -> component tests
- production behavior changes -> at least one test update

## Rollout Modes
- Warning mode: reports violations without blocking.
- Enforce mode: blocks merges on violations.

Default target mode for protected branches: `enforce`.

## Release Preconditions
- Required env vars set for enabled services.
- Migration and post-deploy verifications completed.
- Launch smoke and link checks pass.

## Observability Requirements
- Request IDs present for API traces.
- Error tracking integrated for server/client critical paths.
- Health and watchdog checks operational.
