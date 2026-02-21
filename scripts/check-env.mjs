#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const OPTIONAL = [
  'ADMIN_EMAIL',
  'GEMINI_API_KEY',
  'SEATS_AERO_API_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CRON_SECRET',
  'ALERTS_TOKEN_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'CORS_ALLOWED_ORIGINS',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'SENTRY_DSN',
  'HEALTHCHECK_SECRET',
]

function loadDotEnv(filepath) {
  if (!fs.existsSync(filepath)) return
  const raw = fs.readFileSync(filepath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

const cwd = process.cwd()
loadDotEnv(path.join(cwd, '.env.local'))
loadDotEnv(path.join(cwd, '.env'))

const missingRequired = REQUIRED.filter((k) => !process.env[k] || !process.env[k].trim())
const missingOptional = OPTIONAL.filter((k) => !process.env[k] || !process.env[k].trim())

console.log('Environment check summary')
console.log(`- Required present: ${REQUIRED.length - missingRequired.length}/${REQUIRED.length}`)
console.log(`- Optional present: ${OPTIONAL.length - missingOptional.length}/${OPTIONAL.length}`)

if (missingOptional.length > 0) {
  console.log(`- Optional missing: ${missingOptional.join(', ')}`)
}

if (missingRequired.length > 0) {
  console.error(`- Required missing: ${missingRequired.join(', ')}`)
  process.exit(1)
}

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim()
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
if ((upstashUrl && !upstashToken) || (!upstashUrl && upstashToken)) {
  console.error('- Upstash config invalid: set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN')
  process.exit(1)
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
if (appUrl) {
  try {
    new URL(appUrl)
  } catch {
    console.error('- NEXT_PUBLIC_APP_URL is not a valid URL')
    process.exit(1)
  }
}

console.log('All required environment variables are set.')
