# Documentation Index

Start here for project context, ownership handoff, and operational playbooks.

## Core Entry Points
- PM and product snapshot: `Documentation/PM_PROJECT_DOSSIER.md`
- High-level product/tech overview: `README.md`
- Contribution workflow and quality expectations: `CONTRIBUTING.md`

## Engineering Standards
- Architecture rules: `Documentation/engineering/01-architecture.md`
- Coding standards: `Documentation/engineering/02-coding-standards.md`
- Testing strategy: `Documentation/engineering/03-testing-strategy.md`
- PR review checklist: `Documentation/engineering/04-pr-review-checklist.md`
- Release quality gates: `Documentation/engineering/06-release-quality-gates.md`

## Launch and Operations
- Launch readiness checklist: `Documentation/launch-readiness.md`
- Launch-day runbook: `Documentation/launch-day-runbook.md`
- Release commit checklist: `Documentation/release-commit-checklist.md`
- Vercel environment setup: `Documentation/vercel-env-setup.md`
- Supabase migrations verification: `Documentation/supabase-migrations-verify.md`
- Supabase automation notes: `Documentation/supabase-automation.md`
- OAuth branding setup: `Documentation/oauth-branding-setup.md`
- Automation control plane: `Documentation/automation-control-plane.md`

## Research and Strategy
- Research workspace index: `Documentation/research/README.md`
- Research charter and key questions: `Documentation/research/00-research-charter.md`
- Market evidence log: `Documentation/research/01-evidence-log.md`
- User JTBD and pain points: `Documentation/research/02-user-jtbd.md`
- Gap and opportunity map: `Documentation/research/03-gap-opportunity-map.md`
- Hypothesis and experiment tracker: `Documentation/research/04-hypothesis-experiment-tracker.md`
- Feature prioritization (RICE): `Documentation/research/05-feature-prioritization-rice.md`
- Decision log: `Documentation/research/06-decision-log.md`
- Connected Wallet epic and delivery scope: `Documentation/research/10-connected-wallet-epic.md`
- Card Recommender V2 story map: `Documentation/card-recommender-v2-story-map.md`

## Feature Specs
- Card Recommender V2 PRD: `Documentation/card-recommender-v2-prd.md`
- Card Recommender V2 decision engine spec: `Documentation/card-recommender-v2-decision-engine-spec.md`
- Card Recommender V2 delivery plan: `Documentation/card-recommender-v2-delivery-plan.md`
- UI reset brief: `Documentation/ui-reset-brief.md`

## SQL Utilities
- Migration audit query: `Documentation/sql/launch-migration-audit.sql`
- Post-deploy smoke query: `Documentation/sql/post-deploy-smoke.sql`

## Templates
- PR launch description template: `Documentation/pr-description-launch-template.md`

## Update Rule
When code, APIs, schema, workflows, or environment variables change:
1. Regenerate PM dossier: `npm run pm:dossier:sync`
2. Verify it is fresh: `npm run pm:dossier:check`
