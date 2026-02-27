# Feature Roadmap (Gemini-first)

## Planning principles
- Ship customer-visible improvements every sprint.
- Every feature must have measurable acceptance criteria.
- Every feature task must include explicit required test cases.
- Gate merges on lint + unit tests + build.

## Sprint A (Conversion + Trust)
1. Improve calculator conversion strip
- Inline action chips after results (book/share/alert)
- Add analytics for each CTA
- Add regression tests for CTA rendering and events

2. Harden booking/deep links pipeline
- Move hardcoded booking URLs to DB-backed source with fallback
- Add health checks for 404/redirect loops
- Add tests for URL selection per region

## Sprint B (Speed + Reliability)
1. Award search response-time optimization
- Cache narrative generation and normalize payload size
- Sort by lowest points first then value
- Add API tests for sort + fallback behavior

2. AI advisor resiliency + safe fallback
- Structured fallback response when model/provider fails
- Add tests for no-result, balances-only, and timeout paths

## Sprint C (Revenue + Ops)
1. Affiliate analytics hardening
- Track source page + card rank + region
- Add admin report endpoint tests

2. Workflow operations dashboard v2
- Add queue depth, failed runs, retry actions
- Add API tests for health summary fields

## Assignment policy
- Gemini handles implementation tasks first.
- Codex (me) handles PM packaging, QA gates, and final review.
- Claude/Kimi can be enabled later for parallelization once Gemini flow is stable.
