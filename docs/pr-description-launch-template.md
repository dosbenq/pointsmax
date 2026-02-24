# Launch PR Description Template

Copy/paste this into the PR body and replace bracketed placeholders.

## Summary

This PR prepares PointsMax for launch by adding new customer entry points, hardening reliability, and tightening release gates.

## What Changed

### Product surfaces

- Added standalone award search page: `/award-search`
- Added reverse-search destination discovery page: `/inspire`
- Added both pages to navigation/footer and sitemap

### API + backend

- Updated `POST /api/award-search` to support `include_narrative: false` (for multi-destination fan-out without repeated AI narration)
- Added unit tests for cron alerts route:
  - unauthorized access handling
  - no-active-bonus fast path
  - send + mark-alerted success path

### Release quality

- Expanded smoke checks to include:
  - `/award-search`
  - `/inspire`
- Kept link checks strict with hard-fail on broken URLs

## Why

- Improves user acquisition and activation:
  - power users can run quick flight checks directly
  - new users can start with “where can I go with my points?”
- Reduces launch risk:
  - stronger cron coverage
  - broader route smoke coverage
  - safer award-search fan-out behavior

## Validation

Run locally (completed):

```bash
npm run lint
npx tsc --noEmit
npm run test -- --run
npm run preflight
npm run smoke:http
npm run check:links
```

Expected:

- tests pass
- preflight passes
- smoke passes including `/award-search` and `/inspire`
- link check reports `hard failures: 0` (Hyatt `429` soft block is acceptable)

## Risk / Rollback

### Risk

- New pages depend on `/api/programs`, `/api/user/balances`, and `/api/award-search` behavior.
- Reverse search fans out multiple award-search requests; load may increase with traffic.

### Rollback

- Revert this PR to remove new pages and fan-out path.
- Existing core surfaces (`/calculator`, `/trip-builder`) continue to operate independently.

## Follow-ups (External)

- Set production secrets/envs per `docs/claude-launch-checklist.md`.
- Configure cron auth header for `/api/cron/send-bonus-alerts`.
- Complete production QA and release gate before deploy.

## Reviewer Checklist

- [ ] Product behavior validated for `/award-search` and `/inspire`
- [ ] Cron route tests are meaningful and deterministic
- [ ] Smoke/link/preflight outputs are green
- [ ] No unrelated changes included
