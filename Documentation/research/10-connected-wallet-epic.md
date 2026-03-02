# Connected Wallet Epic (Manual Entry as Fallback)

Date: 2026-02-28  
Status: Approved for implementation  
Owners: Claude (architecture/high-risk), Gemini (implementation/UI)

## Objective
Replace manual-only balance input with a connector-based balance sync system, while keeping manual entry as a fallback.

## Product Outcome
- Users can connect supported loyalty/card accounts and see auto-synced balances.
- The system stores `as_of`, `source`, `confidence`, and `sync_status` per balance.
- Recommendations and alerts consume synced balances by default.
- Manual entry remains available and can override when sync fails.

## Scope (Phase 1)
- Connector framework with pluggable adapters.
- Normalized connected accounts + balance snapshot schema.
- Sync scheduler + retry + stale detection.
- Connected Accounts UI (connect/disconnect/sync status/history).
- API endpoints for account lifecycle and sync triggers.
- Trust metadata in UI: last synced time, source, confidence, stale badge.

## Out of Scope (Phase 1)
- Full direct credential scraping without explicit legal and security review.
- Broad provider coverage beyond first pilot connectors.
- Autonomous booking execution.

## Initial Connector Inputs
- OAuth/API connector path where available.
- Email/statement parsing path.
- CSV import path.
- Manual entry fallback.

## Security and Compliance Requirements
- Encrypt provider tokens/secrets at rest.
- Do not expose service-role privileges to client paths.
- Audit logs for connect/disconnect/sync/manual override.
- One-click disconnect + data deletion path.
- Least-privilege scopes and connector-specific rate limits.

## Delivery Stories (Execution Order)
1. Architecture and data model foundation (`Claude`)
2. Connector orchestration and sync reliability (`Claude`)
3. Connected account API contracts and validation (`Gemini`)
4. Connected Wallet UI + manual fallback UX (`Gemini`)
5. CSV/email ingestion baseline (`Gemini`)
6. Security hardening and operational runbook (`Claude`)

## Acceptance Metrics
- Linked-account onboarding completion rate.
- % active users with at least one synced account.
- Sync success rate and median sync latency.
- % recommendations using non-stale synced balances.
- Support tickets about stale balances.

## Go/No-Go Criteria
- No security regressions in auth/RLS checks.
- Sync pipeline has deterministic retry + DLQ behavior.
- UI clearly indicates balance freshness and source.
- Manual fallback remains functional end-to-end.
