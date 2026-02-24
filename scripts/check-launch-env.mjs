#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
]

const RECOMMENDED = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'SEATS_AERO_API_KEY',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
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

function readEnv() {
  const cwd = process.cwd()
  loadDotEnv(path.join(cwd, '.env.local'))
  loadDotEnv(path.join(cwd, '.env'))
}

function isPresent(key) {
  const v = process.env[key]
  return typeof v === 'string' && v.trim().length > 0
}

function checkUrl(key) {
  const value = process.env[key]?.trim()
  if (!value) return `${key} is missing`
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return `${key} must start with http:// or https://`
    }
  } catch {
    return `${key} is not a valid URL`
  }
  return null
}

function fail(msg) {
  console.error(`- ${msg}`)
}

readEnv()

const missingRequired = REQUIRED.filter((k) => !isPresent(k))
const missingRecommended = RECOMMENDED.filter((k) => !isPresent(k))

console.log('Launch env audit')
console.log(`- Required present: ${REQUIRED.length - missingRequired.length}/${REQUIRED.length}`)
console.log(`- Recommended present: ${RECOMMENDED.length - missingRecommended.length}/${RECOMMENDED.length}`)

if (missingRecommended.length) {
  console.log(`- Recommended missing: ${missingRecommended.join(', ')}`)
}

const validations = [
  checkUrl('NEXT_PUBLIC_APP_URL'),
  checkUrl('NEXT_PUBLIC_SUPABASE_URL'),
]
.filter(Boolean)

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim()
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
if ((upstashUrl && !upstashToken) || (!upstashUrl && upstashToken)) {
  validations.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be set together')
}

if (missingRequired.length) {
  fail(`Required missing: ${missingRequired.join(', ')}`)
}
for (const issue of validations) {
  fail(issue)
}

if (missingRequired.length || validations.length) {
  process.exit(1)
}

console.log('All launch-required environment variables look valid.')
