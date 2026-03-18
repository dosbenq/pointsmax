# PointsMax Launch Hardening Tracker

This document tracks the launch-critical findings, implementation progress, and verification evidence for the Q2 public launch program.

## Launch Bar

- Every public headline claim maps to a fully working, user-accessible flow.
- No launch-critical route, alias, or CTA is broken.
- No hidden stub or unclear fallback behavior in trust-critical flows.
- Public and admin data boundaries are explicit and test-enforced.
- `npm run build`, `npm run test -- --run`, and `npm run smoke:http` pass on every launch candidate.

## Workstreams

| ID | Finding / Opportunity | Severity | Product Area | Owner | Status | Target Phase | Launch Blocker | Verification Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LH-001 | Public server DB access defaults to service-role when configured; public routes must use RLS-respecting clients by default | High | Security / Data boundaries | Agent 1 | Completed | Phase 1 | Yes | Unit tests on server DB client behavior; targeted route audit |
| LH-002 | Cron routes accept query-param secrets; require header-only auth | Medium | Security / Operations | Agent 1 | Completed | Phase 1 | Yes | Route tests for header auth and query-param rejection |
| LH-003 | Admin YouTube ingest accepts arbitrary `channel_url`; add host allowlisting and reject non-YouTube URLs before fetch | High | Security / Connectors | Agent 1 | Completed | Phase 1 | Yes | Unit tests for URL allowlist; admin route tests |
| LH-004 | Admin authorization is single-email based; add structured allowlist support for server and client admin surfaces | Medium | Security / Admin | Agent 1 | Completed | Phase 1 | Yes | Admin auth tests; admin shell behavior validation |
| LH-005 | Smoke suite fails because `/calculator` alias is missing; restore canonical route contract or fix smoke expectations | High | Reliability / Routing | Agent 5 | Completed | Phase 1 | Yes | `npm run smoke:http` |
| LH-006 | Smoke suite expects `/inspire` to resolve to calculator, but product now has a real inspire surface; align smoke to product truth | Medium | Reliability / Product truth | Agent 5 | Completed | Phase 1 | Yes | `npm run smoke:http` |
| LH-007 | Landing page overclaims live and exact-wallet behavior relative to current system state | High | Product truth / Marketing | Agent 6 | Completed | Phase 1 | Yes | Homepage copy updated to execution-focused claims |
| LH-008 | Wallet onboarding is usable, but live provider sync is not ready for broad claims; public copy must center manual/CSV path until provider onboarding is live | High | Wallet concierge | Agent 2 | Completed | Phase 1 | Yes | Wallet readiness callouts and import-first UX copy |
| LH-009 | Award search and trip builder degrade to estimates or safe mode; fallback states need clearer trust labels and stronger actionable output | High | Search / Concierge | Agent 2 | Completed | Phase 1 | Yes | Shared trust-state UI on award search and trip builder |
| LH-010 | Core release process needs stronger gates for route truth, degraded-mode behavior, and third-party dependency failures | High | Release engineering | Agent 5 | In progress | Phase 2 | Yes | Local launch gate, expanded smoke coverage, and boundary-fix follow-up in `Documentation/implementation/agent-reports/lh-010-release-gates.md` |
| LH-011 | US coverage is stronger than India; region parity needs explicit route, content, and catalog validation before broad launch | Medium | Regional completeness | Codex | Completed | Phase 2 | Yes | Region-aware cards, programs, home, inspire, and how-it-works surfaces now ship with dual-market route smoke coverage |
| LH-012 | Content and card surfaces need tighter linkage to redemption workflows to improve conversion and product differentiation | Medium | Content / Card strategy | Codex | Completed | Phase 2 | No | Card and program index/detail pages now link directly into wallet, calculator, award-search, trip-builder, and playbook flows |
| LH-013 | Growth cannot rely on SEO alone; launch distribution needs creator, community, and shareable workflow surfaces | Medium | GTM / Distribution | Codex | Completed in-repo tranche | Phase 3 | No | Homepage, footer, how-it-works, inspire, cards, and programs now form a clearer launch funnel around playbooks, booking, wallet, and card strategy |

## Verification Checklist

### Technical gates

- [x] `npm run build`
- [x] `npm run test -- --run`
- [x] `npm run smoke:http`
- [x] Public/admin DB boundary tests pass
- [x] Cron auth tests pass
- [x] YouTube allowlist tests pass
- [x] Route parity and alias checks pass

### Product gates

- [x] Homepage claims match actual live product behavior
- [x] Wallet onboarding is usable for a first-time public user
- [x] Search results clearly distinguish live vs estimated states
- [x] Trip output remains actionable in degraded mode
- [x] Card strategy links back into real booking workflows
- [x] US and India public routes both feel intentional and complete

## Notes

- This tracker should be updated with PR links, rollout notes, and verification output as launch work lands.
- A finding stays open until verification evidence is attached, not just when code is merged.
- Latest verification pass on 2026-03-18: `npm run build`, `npm run test -- --run`, `npm run smoke:http`, and `npm run quality:boundaries` all passed after the region-parity, card/program workflow-linkage, and launch-funnel updates.
- The remaining broad-launch work that is still open is operational and off-repo in nature: distribution execution, production monitoring, SLO alerting, and rollout controls.
