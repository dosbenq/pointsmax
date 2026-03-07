# Launch PR Description Template

Copy/paste this into the PR body and replace bracketed placeholders.

## Summary

This PR prepares PointsMax for launch by hardening core customer flows and tightening release gates.

## What Changed

### Product surfaces

- Consolidated customer entry points around Planner, Card Strategy, and Wallet
- Reduced redundant top-level routes in navigation/footer and sitemap

### API + backend

- Updated `POST /api/award-search` to support `include_narrative: false` (for multi-destination fan-out without repeated AI narration)
- Added unit tests for cron alerts route:
  - unauthorized access handling
  - no-active-bonus fast path
  - send + mark-alerted success path

### Release quality

- Expanded smoke checks to include:
  - `/us/calculator`
  - `/us/card-recommender`
  - `/profile`
- Kept link checks strict with hard-fail on broken URLs

## Why

- Improves user acquisition and activation:
  - the primary flows are clearer and less fragmented
  - the product emphasizes planning and card strategy instead of scattered tools
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
- smoke passes including `/us/calculator`, `/us/card-recommender`, and `/profile`
- link check reports `hard failures: 0` (Hyatt `429` soft block is acceptable)

## Risk / Rollback

### Risk

- Primary flows depend on `/api/programs`, `/api/user/balances`, `/api/calculate`, and `/api/award-search` behavior.

### Rollback

- Revert this PR to restore the previous top-level navigation and page structure.
- Existing APIs remain independently testable.

## Follow-ups (External)

- Set production secrets/envs per `Documentation/launch-readiness.md`.
- Configure cron auth header for `/api/cron/send-bonus-alerts`.
- Complete production QA and release gate before deploy.

## Reviewer Checklist

- [ ] Product behavior validated for `/us/calculator`, `/us/card-recommender`, and `/profile`
- [ ] Cron route tests are meaningful and deterministic
- [ ] Smoke/link/preflight outputs are green
- [ ] No unrelated changes included
