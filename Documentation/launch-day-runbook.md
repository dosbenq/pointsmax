# Launch Day Runbook

Date: [YYYY-MM-DD]  
Owner: [Name]  
Approver: [Name]

## 0) Launch Criteria

All must be true before deploy:

- `Documentation/launch-readiness.md` items are complete.
- GitHub `CI` and `Release Gate` workflows are green.
- Production env/secrets are configured.
- Cron job auth and monitoring are verified.

## 1) T-60 Minutes (Pre-Deploy)

1. Confirm branch and commit hash to deploy.
2. Re-run local checks from clean workspace:
   ```bash
   npm ci
   npm run lint
   npx tsc --noEmit
   npm run test -- --run
   npm run preflight
   npm run smoke:http
   npm run check:links
   ```
3. Confirm checklist completion in `Documentation/launch-readiness.md`.
4. Announce launch window in team channel.

## 2) T-30 Minutes (Production Readiness)

1. Verify production env vars are present:
   - `CRON_SECRET`, `ALERTS_TOKEN_SECRET`
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   - `SEATS_AERO_API_KEY` (if enabled)
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
   - `HEALTHCHECK_SECRET`, `SENTRY_DSN`
2. Confirm Resend sender domain status is verified.
3. Confirm cron scheduler is configured with:
   - URL: `/api/cron/send-bonus-alerts`
   - Header: `Authorization: Bearer <CRON_SECRET>`
4. Use detailed setup guides:
   - Vercel envs: `Documentation/vercel-env-setup.md`
   - Supabase migrations: `Documentation/supabase-migrations-verify.md`

## 3) Deploy

1. Merge approved PR.
2. Deploy to production.
3. Record deployed commit hash and deployment ID.

## 4) T+10 Minutes (Smoke in Production)

Run manual smoke against production URL:

1. `/`
2. `/us/calculator`
3. `/us/card-recommender`
4. `/profile`
5. `/pricing`

Expected:

- All pages load with no blocking console/network errors.
- Planner loads and returns results.
- Card Strategy loads and ranks cards.

## 5) T+20 Minutes (Critical Functional Checks)

1. Auth flow:
   - Sign in
   - balances load/save
   - preferences load/save
2. Alerts flow:
   - subscribe request success
   - unsubscribe token flow success
3. Admin flow:
   - create transfer bonus
   - cron path processes safely
4. Stripe webhook smoke test:
   ```bash
   npm run smoke:stripe:webhook -- \
     --url https://<your-domain>/api/stripe/webhook \
     --secret <whsec_xxx> \
     --mode checkout \
     --user-id <users.id> \
     --customer-id <cus_xxx>
   ```

## 6) T+30 Minutes (Monitoring Validation)

1. Hit `/api/health` with `x-health-secret` and confirm healthy response.
2. Verify uptime monitor sees healthy state.
3. Verify Sentry receives a controlled test error (if enabled).
4. Confirm no spike in 5xx responses in host logs.

## 7) Rollback Procedure (If Needed)

Trigger rollback if any of:

- sustained 5xx rate > [threshold]
- core flow broken (`/us/calculator`, `/us/card-recommender`, auth, alerts)
- cron processing failing with user-visible impact

Rollback steps:

1. Redeploy previous stable release.
2. Disable failing cron job temporarily.
3. Post incident summary in team channel.
4. Open hotfix issue with logs and timestamped evidence.

## 8) AI & Data Pipeline Diagnostics

After launch, monitor the health of AI and background tasks:

1. **AI Latency & Fallbacks**:
   - Check `/api/health` (authorized) for `telemetry.ai.avg_latency_ms`.
   - Normal range: 2,000ms - 8,000ms.
   - If `avg_latency_ms > 15,000ms`, investigate Gemini quota or region latency.
   - Check logs for `ai_recommend_model_fallback_used` to see if primary models are failing.

2. **Background Queues (Inngest)**:
   - Check `/api/health` (authorized) for `telemetry.queue.avg_processing_time_ms`.
   - Monitor `inngest_function_failed` logs for recurring task failures.
   - Use Inngest Cloud Dashboard to verify queue depth and backlog if `avg_processing_time_ms` spikes.

3. **Error Rates**:
   - Monitor `telemetry.errors` in health check. A sudden spike indicates downstream API changes (e.g., Seats.aero or Gemini API updates).

## 9) Launch Complete

1. Confirm stable for 60 minutes post-deploy.
2. Announce launch completion with:
   - deployed commit hash
   - checklist status
   - known follow-ups (if any)
