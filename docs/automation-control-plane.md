# Automation Control Plane

This project now has a single automation entrypoint to keep runtime architecture healthy:

```bash
npm run ops:watchdog
```

## What it checks

1. Core API health (`/api/health`)
2. Region card catalogs (`/api/cards?geography=US|IN`)
3. Calculator performance and correctness (`/api/calculate`)
   - Fails if `X-Calculate-Latency-Ms` exceeds `MAX_CALCULATE_LATENCY_MS` (default `2500`)
4. Award search responsiveness (`/api/award-search`)
5. AI recommendation route (`/api/ai/recommend`)
6. Affiliate click telemetry (`/api/analytics/affiliate-click`)
7. Alerts subscription path (`/api/alerts/subscribe`)
8. Cron automation chain:
   - `/api/cron/update-valuations`
   - `/api/cron/send-bonus-alerts`
   - `/api/cron/ingest-youtube-knowledge`

Optional:
- `CHECK_EXPERT_CHAT=1` enables `/api/ai/expert-chat` checks.

## Required env vars

- `BASE_URL`
- `CRON_SECRET`

Optional override env vars:
- `PROGRAM_ID`
- `CARD_ID`
- `TEST_EMAIL`
- `MAX_CALCULATE_LATENCY_MS`
- `CHECK_EXPERT_CHAT`

## CI automation

A scheduled GitHub Action runs every 6 hours:

- Workflow: `.github/workflows/automation-watchdog.yml`
- Trigger: `schedule` + manual `workflow_dispatch`
- Required repo secrets:
  - `BASE_URL`
  - `CRON_SECRET`
- Optional repo secrets:
  - `PROGRAM_ID`, `CARD_ID`, `TEST_EMAIL`

## Full launch automation

Use autopilot for full checks:

```bash
npm run launch:autopilot
```

New step included:
- `Automation watchdog (speed + cron + agents)`

Skip flags:
- `--skip-smoke`
- `--skip-watchdog`
- `--skip-db`
