# Vercel Production Env Setup (Copy/Paste)

This runbook sets the launch-blocking production env vars via Vercel CLI.

## 1) Prerequisites

1. `vercel` CLI installed and logged in.
2. Linked to the correct project:
   ```bash
   vercel link
   ```
3. Confirm project:
   ```bash
   vercel project ls
   ```

## 2) Set Variables Locally in Your Shell

Replace placeholders first:

```bash
export RESEND_API_KEY="re_xxx"
export RESEND_FROM_EMAIL="alerts@yourdomain.com"
export NEXT_PUBLIC_APP_URL="https://pointsmax.com"
export NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="ey..."
export SUPABASE_SERVICE_ROLE_KEY="ey..."
export STRIPE_SECRET_KEY="sk_live_xxx"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_xxx"
export STRIPE_WEBHOOK_SECRET="whsec_xxx"
export STRIPE_PRO_PRICE_ID="price_xxx"
export CRON_SECRET="$(openssl rand -hex 32)"
export INNGEST_EVENT_KEY="evt_xxx"
export INNGEST_SIGNING_KEY="signkey_xxx"
```

Optional but recommended for launch:

```bash
export UPSTASH_REDIS_REST_URL="https://xxxx.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="xxxx"
export SEATS_AERO_API_KEY="xxxx"
```

## 3) Push to Vercel Production

These commands overwrite existing values safely by removing then re-adding:

```bash
for key in \
  RESEND_API_KEY \
  RESEND_FROM_EMAIL \
  NEXT_PUBLIC_APP_URL \
  NEXT_PUBLIC_SUPABASE_URL \
  NEXT_PUBLIC_SUPABASE_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY \
  STRIPE_SECRET_KEY \
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  STRIPE_WEBHOOK_SECRET \
  STRIPE_PRO_PRICE_ID \
  CRON_SECRET \
  INNGEST_EVENT_KEY \
  INNGEST_SIGNING_KEY \
  UPSTASH_REDIS_REST_URL \
  UPSTASH_REDIS_REST_TOKEN \
  SEATS_AERO_API_KEY
do
  vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "${!key}" | vercel env add "$key" production
done
```

If you are not using an optional variable yet, skip it in the loop.

## 4) Verify Values Exist

```bash
vercel env ls production
```

Expected: all required keys above are listed.

PointsMax now pins Node `20.x` in `package.json`, so Vercel should use the same major version as GitHub Actions.

## 5) Redeploy to Apply

```bash
vercel --prod
```

Then run post-deploy checks from `./Documentation/launch-day-runbook.md`.
