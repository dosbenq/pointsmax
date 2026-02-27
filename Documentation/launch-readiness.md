# PointsMax Launch Readiness

## Verification Snapshot (2026-02-21)

- `npm run check:env` passes (required vars present).
- `npm run test -- --run` passes (`12/12` files, `31/31` tests).
- `npm run preflight` passes (env check + lint + typecheck + prod build).
- `npm run smoke:http` passes (critical marketing/product routes).
- `npm run check:links` passes with `hard failures: 0` (`1` soft bot-throttle on Hyatt).

## Completed in Code

- Distributed rate limiting with Upstash Redis support and automatic in-memory fallback.
- Consistent request-size limits and rate limits on critical POST APIs.
- CORS support for API routes with configurable allowlist via `CORS_ALLOWED_ORIGINS`.
- Security headers enabled site-wide (`CSP`, `HSTS` in production, frame/content-type/referrer/permissions policies).
- `x-request-id` propagation from middleware to responses for request tracing.
- Public health endpoint improved with uptime/version and protected sensitive diagnostics.
- Outbound-link checker script (`npm run check:links`) with hard-fail behavior on 4xx/5xx issues.
- End-to-end smoke script for built app (`npm run smoke:http`) covering key customer routes.
- CI workflows for PR/push verification, scheduled link checks, and release-gate runs.

## Required External Launch Steps

1. Configure production secrets in hosting platform:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `CRON_SECRET`
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`
   - `ALERTS_TOKEN_SECRET`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `NEXT_PUBLIC_APP_URL`
   - `CORS_ALLOWED_ORIGINS`
   - `HEALTHCHECK_SECRET`
   - `SENTRY_DSN` (optional)

2. DNS and domain:
   - Point `pointsmax.com` (and optional `www`) to production host.
   - Configure canonical redirect behavior (`www` -> apex or apex -> `www`).

3. Email deliverability:
   - Add SPF, DKIM, and DMARC records for the sending domain used by Resend.
   - Verify sender domain in Resend dashboard.

4. Monitoring and alerting:
   - Attach uptime monitor to `/api/health` and include `x-health-secret` header.
   - Configure error tracking destination for `SENTRY_DSN` (optional but recommended).

5. Cron and automation:
   - Ensure scheduled job calls `/api/cron/send-bonus-alerts` with `Authorization: Bearer <CRON_SECRET>`.

6. Final release gate:
   - Run GitHub Action: `Release Gate`.
   - Verify pass for preflight, link health, and smoke checks.
