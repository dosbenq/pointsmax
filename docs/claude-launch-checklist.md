# Claude Launch Handoff Checklist

Last updated: 2026-02-21 (local verification complete by Codex)

## Already Completed in Repo

- [x] Lint/typecheck/build pipeline is green.
- [x] Unit/API tests are green (`31/31`).
- [x] Smoke checks pass for `/`, `/calculator`, `/award-search`, `/inspire`, `/card-recommender`, `/earning-calculator`, `/trip-builder`, `/pricing`, `/how-it-works`.
- [x] Outbound links have `hard failures: 0`.
- [x] Security/rate-limit/cors/health hardening is implemented in code.

## Remaining Tasks for Claude (External/Deployment)

## 1) Production Environment Variables

- [ ] Set `ADMIN_EMAIL`.
- [ ] Set `SEATS_AERO_API_KEY` (if real award search is enabled).
- [ ] Set `RESEND_API_KEY`.
- [ ] Set `RESEND_FROM_EMAIL`.
- [ ] Set `CRON_SECRET`.
- [ ] Set `ALERTS_TOKEN_SECRET`.
- [ ] Set `CORS_ALLOWED_ORIGINS`.
- [ ] Set `UPSTASH_REDIS_REST_URL`.
- [ ] Set `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Set `INNGEST_EVENT_KEY` (required for booking workflow events).
- [ ] Set `INNGEST_SIGNING_KEY` (required to verify `/api/inngest` requests).
- [ ] Set `HEALTHCHECK_SECRET`.
- [ ] Set `SENTRY_DSN` (recommended).

Acceptance criteria:
- `npm run check:env` reports no missing vars required for enabled features.

## 2) Email + Alerts

- [ ] Verify Resend sender domain.
- [ ] Configure SPF, DKIM, and DMARC records.
- [ ] Trigger a test subscribe flow and confirm delivery.
- [ ] Trigger a test unsubscribe flow and confirm token handling.

Acceptance criteria:
- Real email is delivered and unsubscribe fully works end-to-end.

## 3) Cron + Background Jobs

- [ ] Configure scheduler to call `/api/cron/send-bonus-alerts`.
- [ ] Use `Authorization: Bearer <CRON_SECRET>` for auth.
- [ ] Confirm jobs run on schedule and log successful execution.

Acceptance criteria:
- At least one successful scheduled run visible in production logs.

## 4) Redis Rate Limiting

- [ ] Verify Upstash credentials are valid in production.
- [ ] Confirm API responses include rate-limit headers under load.
- [ ] Confirm multi-instance behavior is consistent (not per-instance only).

Acceptance criteria:
- Rate limits remain consistent across repeated requests.

## 5) Monitoring + Incident Response

- [ ] Attach uptime monitor to `/api/health` with `x-health-secret`.
- [ ] Verify non-2xx alert routing (email/Slack/Pager).
- [ ] Verify `SENTRY_DSN` ingestion with a test error.

Acceptance criteria:
- Health and error alerts are received by the on-call channel.

## 6) Final Production QA

- [ ] Anonymous flow: landing -> calculator -> award search -> AI advisor.
- [ ] Standalone search flow: `/award-search` with wallet balances and booking links.
- [ ] Reverse search flow: `/inspire` returns ranked destination ideas for selected month/region.
- [ ] Auth flow: sign in -> balances/preferences save/load.
- [ ] Trip builder flow: exact dates + flexible date search.
- [ ] Save a watch from `/award-search` and verify it appears in `/api/flight-watches`.
- [ ] Start + progress booking workflow from `/trip-builder` (`/api/booking-guide/start`, `/api/booking-guide/step-complete`).
- [ ] Card recommender flow: recommendations render from live `/api/cards`.
- [ ] Admin flow: bonuses/programs/users pages work with policy checks.

Acceptance criteria:
- No blocking errors in browser console/network for core flows.

## 7) Launch Gate Run

- [ ] Run GitHub Action `Release Gate`.
- [ ] Confirm all jobs pass before deploy.
- [ ] Tag release and deploy.

Acceptance criteria:
- `Release Gate` succeeds and deployment health check is green.
