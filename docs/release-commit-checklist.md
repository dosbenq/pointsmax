# Release Commit Checklist (Claude Review)

For external deployment tasks, use `docs/claude-launch-checklist.md` as the source of truth.

## 1) Scope Verification

- [ ] Confirm this release only includes launch-hardening + copy cleanup changes (no unrelated feature work).
- [ ] Confirm all changed customer-facing copy is consistent across `/`, `/how-it-works`, and `/pricing`.
- [ ] Confirm all outbound booking links remain current and non-broken (allowing known bot-throttle exceptions).

## 2) High-Risk Files to Review First

- [ ] `src/lib/api-security.ts` (distributed rate limiting + fallback behavior)
- [ ] `middleware.ts` (CORS logic, request-id propagation, matcher behavior)
- [ ] `next.config.ts` (CSP and security header policy)
- [ ] `src/app/api/health/route.ts` (sensitive detail gating)
- [ ] `src/lib/logger.ts` + `src/lib/monitoring.ts` (error reporting path)
- [ ] `src/app/api/ai/recommend/route.ts` / `src/app/api/trip-builder/route.ts` / `src/lib/award-search/deep-links.ts` (link allowlists)

## 3) Copy/Content Review

- [ ] Landing: scenario section explicitly framed as illustrative (not guaranteed outcomes).
- [ ] Pricing: no placeholder launch language remains.
- [ ] Pricing + How-it-works: AI usage language reflects fair-use limits (not unlimited claims).
- [ ] Branding/contact/domain copy is consistent with `pointsmax.com`.

## 4) Automated Checks (must pass)

Run exactly:

```bash
npm run lint
npx tsc --noEmit
npm run test -- --run
npm run build
npm run smoke:http
npm run check:links
npm run preflight
```

Expected:
- No lint/type/test/build failures.
- Smoke test passes for key routes.
- `check:links` reports `hard failures: 0`.
- A `SOFT 429` for Hyatt is acceptable (anti-bot behavior), not a broken link.

## 5) Manual Product QA

- [ ] Anonymous user flow: landing -> calculator -> award search -> AI advisor request.
- [ ] Authenticated flow: sign in -> saved balances load -> calculator results -> trip builder.
- [ ] Trip builder: exact dates and flexible month mode both work; hotel nights behavior is sensible.
- [ ] Alerts flow: subscribe/unsubscribe works and error messages are user-safe.
- [ ] Admin flow: create bonus and verify cron trigger path is invoked securely.

## 6) Environment & Infra Gate

- [ ] Production secrets set: `CRON_SECRET`, `ALERTS_TOKEN_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CORS_ALLOWED_ORIGINS`, `HEALTHCHECK_SECRET`.
- [ ] `NEXT_PUBLIC_APP_URL` is production canonical domain.
- [ ] DNS + canonical redirect configured.
- [ ] Email DNS configured (SPF/DKIM/DMARC) and sender verified.
- [ ] Uptime monitor configured for `/api/health` with `x-health-secret`.

## 7) Release Workflow Gate

- [ ] GitHub Action `CI` green on commit/PR.
- [ ] Run GitHub Action `Release Gate` and verify all steps pass.
- [ ] Optional: run `Link Health` workflow manually before deploy.

## 8) Merge Decision

- [ ] No blocker findings in sections 2-7.
- [ ] Any non-blocking risk accepted explicitly in PR notes.
- [ ] Tag release and deploy.
