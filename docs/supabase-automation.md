# Supabase Automation (Low-Intervention)

This project now includes non-interactive helpers to apply and verify migrations via `psql`.
It also includes a one-command launch autopilot for full CLI control.

## Prerequisites

1. Install `psql` (PostgreSQL client tools).
2. Add `SUPABASE_DB_URL` to `.env.local`:

```bash
SUPABASE_DB_URL=postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

Do not commit this value.

## Commands

Run from:
`/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax`

### 1) Verify migration/security state

```bash
npm run supabase:verify
```

Runs:
`/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/docs/sql/launch-migration-audit.sql`

### 2) Apply one or more migrations

Default (applies workflow/security baseline migrations `009` and `010`):

```bash
npm run supabase:apply
```

Apply specific files:

```bash
node scripts/supabase-ops.mjs apply 007_india_cards.sql,008_affiliate_clicks.sql,009_security_hardening_rls.sql,010_flight_watches.sql
```

### 3) Apply + verify in one step

```bash
npm run supabase:sync
```

Or with explicit files:

```bash
node scripts/supabase-ops.mjs sync 009_security_hardening_rls.sql,010_flight_watches.sql
```

### 4) Post-deploy SQL smoke checks

```bash
npm run supabase:postcheck
```

Runs:
`/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/docs/sql/post-deploy-smoke.sql`

### 5) Full launch autopilot (single command)

```bash
npm run launch:autopilot
```

Runs launch checks in sequence:
1. `check:launch-env`
2. `supabase:verify`
3. `lint`
4. `test`
5. `build`
6. `smoke:prod` (requires `BASE_URL` and `CRON_SECRET`)
7. `supabase:postcheck`

Quick mode (skip lint/test/build):

```bash
npm run launch:autopilot:quick
```

Apply default workflow/security baseline migrations (`009` + `010`) before the rest:

```bash
npm run launch:autopilot:apply
```

Useful direct flags:

```bash
node scripts/launch-autopilot.mjs --quick --skip-db
node scripts/launch-autopilot.mjs --skip-smoke
node scripts/launch-autopilot.mjs --help
```

## Safety Notes

1. `supabase:apply` intentionally defaults to migrations `009` and `010` only.
2. Older migrations are not guaranteed to be idempotent; apply them explicitly only when needed.
3. Keep `SUPABASE_DB_URL` in local/Vercel secrets only.
