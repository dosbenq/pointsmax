# Claude Strategy Review: Business Critical Review and Corrected 6-Week Plan

Date: 2026-02-28
Reviewer: Claude (Sonnet 4.6)
Inputs: `/tmp/kimi_strategy_report.txt`, `08-kimi-report-synthesis.md`, `03-gap-opportunity-map.md`, `05-feature-prioritization-rice.md`, `06-decision-log.md`, `02-user-jtbd.md`, `04-hypothesis-experiment-tracker.md`

---

## 1. Verdict

**Proceed — with scope reduction and sequencing corrections.**

The Kimi report correctly identifies the execution gap as the primary market opportunity and the trust deficit as the primary AI adoption barrier. These are grounded in consistent evidence across multiple sources. The strategic frame ("wallet-aware execution assistant") is differentiated and defensible.

However, the report is overscoped for a 30-60 day startup window, includes unverifiable source citations that inflate confidence, and conflates moat-building with MVP delivery. The corrected plan below strips the first 6 weeks to three tightly sequenced bets.

---

## 2. Strengths (Confirmed, Adopt)

- **Execution gap thesis is real.** 60% of discovered award opportunities are abandoned due to booking complexity. No competitor successfully bridges discovery to execution. This is validated by Point.me's $200+ concierge service existing at all — it proves willingness to pay for guided execution.
- **Trust deficit is an opening, not just a constraint.** 52% of AI travel users report dissatisfaction with generic/incorrect responses. Competitors have no citation enforcement. Grounded, cited answers are genuinely differentiated if delivered at product quality — not just a nice-to-have.
- **The "tell me exactly what to do with my wallet now" positioning is tight.** It passes the elevator test and maps directly to J-001 and J-002 in the JTBD framework.
- **Competitor coverage creates opportunity.** AwardWallet has data without intelligence. CardPointers has earn-side intelligence without burn-side. Point.me has execution guidance that doesn't scale. Roame has speed without guidance. The gap at the intersection is genuine.
- **India market signal is legitimate.** SaveSage's traction via 1-on-1 consultations confirms demand for personalized guidance in the India market where global tools are thin. This is a real wedge, not a distraction.

---

## 3. Risks

### 3a. Source Integrity Risk — HIGH
Multiple claim chains in the Kimi report use `(Source)` placeholders that could not be resolved from the exported document. Specific numbers at risk:
- "60% abandonment after discovery" — directionally plausible but unverified
- "3-5x community vs. paid acquisition" — no source resolvable
- "4-week MVP scope achievable" — based on benchmark projects with different constraints

**Corrective action:** Before quoting any stat in external materials or investor conversations, verify it against the original primary source. Flag unresolved citations in `01-evidence-log.md`. Do not treat Kimi report numbers as hard data for planning purposes — treat them as directional hypotheses that need internal baseline data.

### 3b. Scope Overload Risk — HIGH
The report recommends simultaneous delivery of:
- Context Intelligence System (10 curated sources, ingestion pipeline)
- Citation enforcement layer
- Guided booking action strip
- Wallet-aware alert explanations
- Creator partnership pipeline
- B2B licensing model exploration
- Regulatory review

This is 6-9 months of work framed as 4-6 weeks. A startup team attempting all of this in parallel will ship none of it well.

### 3c. Agentic AI Timing Risk — MEDIUM
Virgin Atlantic's December 2025 OpenAI concierge launch and "60%+ of travel businesses experimenting with agentic AI" are cited as urgency drivers. This is partially true but overstated. These are experiments, not shipped products with retention. First-mover advantage in agentic travel AI is not a 4-week window — it is a 6-12 month window. The correct response is focused quality delivery, not broad scope.

### 3d. Monetization Sequence Risk — MEDIUM
The report presents subscription + affiliate + B2B licensing as a "diversified revenue path" without sequencing. Attempting to build all three in 30-60 days introduces product complexity before product-market fit is established. B2B licensing especially requires 3-6 months of proven usage data before any card issuer conversation is credible.

### 3e. Creator Partnership Dependency Risk — LOW-MEDIUM
"5+ creator endorsements at launch" is listed as a critical success factor. Creator endorsements in the points-and-miles space require demonstrated product quality, not just outreach. Scheduling this as a launch gate without a working product is backwards. Creators should be shown a working beta, not a plan.

---

## 4. Overscope Items — Remove from 6-Week Window

The following items are valuable long-term but should not be in the 6-week plan:

| Item | Why It Belongs Later |
|---|---|
| B2B white-label licensing to card issuers | Requires usage proof; distraction pre-PMF |
| Creator partnership as a launch gate | Requires working product first |
| India market-specific ingestion | Scope extension; validate US/global base first |
| Community credibility campaign | Premature without retention data |
| Multi-threaded monetization setup | Run subscription hypothesis first |
| Comprehensive regulatory audit | Do targeted review; full audit is overkill at MVP |
| Generational UX segmentation (Millennial vs Gen X/Boomer) | One cohort first |
| Agentic booking completion (full autonomous execution) | Guided steps are sufficient for MVP |

---

## 5. Corrected 6-Week Plan

**Guiding constraint:** One cohort, one channel, three bets, measurable gates at each.

### Week 1-2: Trust Infrastructure (must ship before user-facing)
- `CI-001`: Stand up ingestion for 10 curated sources (prioritize: program blogs, TPG/NerdWallet valuations, airline transfer ratio pages). Include freshness metadata and source URL per document.
- `CI-002`: Enforce strict citation policy in AI layer — no factual answer without `[Source: <name>, <date>]`. Implement confidence banding (high/medium/low) in API output. Hallucination rate target: <1% on internal test set.
- `CI-005`: Ship instrumentation first. Retrieval relevance, citation coverage, p95 latency, answer acceptance rate. No feature ships without a metric attached.

**Gate to proceed:** Retrieval relevance ≥ 0.70 on internal benchmark. Citation coverage 100% on factual test cases. p95 latency <3s.

### Week 3-4: Execution Surface (user-facing differentiation)
- `CI-003`: Add guided transfer + booking action strip to top redemption results. One clear next step per result: "Transfer X points from [program] to [program] → then book at [airline site]."
- `CI-004`: Add alert explanation cards tied to user balances. One sentence per alert: "This matters because you have 45,000 Chase UR and this route prices at 40,000 — exact match."

**Gate to proceed:** Helpfulness rate ≥ 70% on beta prompt set (manual evaluation against 50 representative queries). CTA click-through on action strip measurably above baseline.

### Week 5-6: Signal Capture and Calibration
- Run H-001 (wallet display → conversion), H-002 (citation → helpfulness), H-003 (booking strip → drop-off reduction) as live experiments.
- Collect retrieval quality data from real usage. Recalibrate RICE scores in `05-feature-prioritization-rice.md` based on actual telemetry.
- Produce week-6 scorecard: Did any hypothesis validate? What does the next 30 days look like based on data?

**Gate for next phase:** At least 2 of 4 hypotheses show directional signal (not necessarily statistical significance at this scale). If zero validate, run a root cause session before expanding scope.

---

## 6. Kill List

Stop or deprioritize immediately if consuming engineering time:

- Any B2B licensing design work
- Creator partnership outreach before a working beta exists
- India-specific ingestion pipeline
- Multi-segment UX (ship one UX for one primary user type first)
- Autonomous booking execution (guided steps are the right v1)
- Any metric that lacks a measurement plan (RICE scores with TBD inputs should be marked `unscored` not estimated)

---

## 7. Go/No-Go Metrics (Reconfirmed from Synthesis + Adjusted)

These are the only metrics that should gate a broader rollout decision at week 6:

| Metric | Target | Source |
|---|---|---|
| Retrieval relevance on internal benchmark | ≥ 0.70 | CI-001 gate |
| Citation coverage in AI responses | 100% on factual claims | CI-002 gate |
| AI response p95 latency | < 3s | CI-005 |
| User helpfulness on beta prompt set | ≥ 70% positive | H-002 |
| Hallucination incident rate (verified) | < 1% | CI-002 audit |
| Action strip CTA click-through | Directionally positive vs. baseline | H-001 |

**Assumption stated:** These targets assume a beta cohort of 50-200 users and a prompt set of 50-100 representative queries. Statistical significance at this scale is not achievable — use directional signal plus qualitative review.

---

## 8. Roadmap Deltas (Clear Bullet Form)

Changes recommended vs. current synthesis (`08-kimi-report-synthesis.md`):

- **Remove** B2B licensing from 30-day plan entirely. Move to 90-day backlog.
- **Remove** creator partnership as a launch gate. Add it as a 45-day milestone contingent on working beta.
- **Remove** India market scope from 30-60 day window. Add it as 90-day opportunity pending US/global PMF signal.
- **Add** explicit retrieval gate before CI-003/CI-004 ship to users. Do not expose guided execution UX if retrieval quality is below 0.70.
- **Add** week-6 scorecard as a mandatory delivery. Not a slide — a data-driven decision on what to expand vs. kill in the next 30-day block.
- **Reframe** RICE scores for F-001 through F-003 as `unscored` until telemetry is available. Remove TBD-input estimates from planning conversations.
- **Add** a single monetization hypothesis to test in week 5-6: Does a paid tier gate on premium execution guidance show conversion intent? This can be a fake door test — no actual payment infrastructure required.
- **Retain** all go/no-go metrics from the synthesis, with the assumption clarification added above.

---

## 9. Internal Consistency Check

Cross-checked against existing research files:

| Claim in Kimi/Synthesis | Consistency with Research Files |
|---|---|
| Execution gap > discovery gap | Consistent with J-002, P-002, O-001 |
| Trust deficit as core AI barrier | Consistent with J-003, P-003, H-002 |
| Citation enforcement as differentiator | Consistent with F-004, F-007 |
| Guided booking strip as P0 | Consistent with F-005 RICE score and J-002 |
| Wallet-aware alerts as P1 | Consistent with F-006 RICE and J-001 |
| India market as wedge | Consistent with O-001 regional expansion signal |
| Go/No-Go metrics | Consistent with synthesis gates; latency/hallucination targets unchanged |
| Creator partnership as critical at launch | **Inconsistent** — no hypothesis in H-tracker, no evidence baseline, premature for 30-day window |
| B2B licensing in 30-day scope | **Inconsistent** — no evidence baseline, no decision rationale in D-002 |

---

## 10. Final Recommendation

Execute CI-001 through CI-005 in the sequenced order above. Do not parallelize trust infrastructure and user-facing execution features — the former must gate the latter.

Cut B2B and creator partnership from the 30-day plan entirely. Run the week-6 scorecard as a hard checkpoint. If retrieval quality and helpfulness thresholds are not met by end of week 4, delay the execution surface UX and fix the foundation first.

The positioning is right. The scope is wrong. Fix the scope and execute.
