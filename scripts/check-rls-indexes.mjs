#!/usr/bin/env node
/**
 * check-rls-indexes.mjs
 *
 * Static audit of migration files to verify all required RLS-supporting
 * indexes are defined. Runs without a database connection — suitable for CI.
 *
 * Usage:
 *   node scripts/check-rls-indexes.mjs
 *   npm run check:rls-indexes
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')

/**
 * Each entry defines an expected index and which migration file(s) to scan.
 * `pattern` is a regex matched against the combined SQL of all listed files.
 */
const REQUIRED_RLS_INDEXES = [
  {
    name: 'users(auth_id) — UNIQUE constraint',
    table: 'users',
    column: 'auth_id',
    files: ['002_auth_preferences.sql'],
    pattern: /ALTER TABLE users ADD COLUMN auth_id\s+UUID\s+UNIQUE/i,
    notes: 'UNIQUE constraint creates an implicit btree index (migration 002)',
  },
  {
    name: 'idx_balances_user on user_balances(user_id)',
    table: 'user_balances',
    column: 'user_id',
    files: ['001_initial_schema.sql'],
    pattern: /CREATE INDEX\s+idx_balances_user\s+ON\s+user_balances\(user_id\)/i,
    notes: 'btree index from migration 001',
  },
  {
    name: 'user_preferences PRIMARY KEY on user_id',
    table: 'user_preferences',
    column: 'user_id',
    files: ['002_auth_preferences.sql'],
    pattern: /user_id\s+UUID\s+PRIMARY KEY/i,
    notes: 'PRIMARY KEY creates an implicit btree index (migration 002)',
  },
  {
    name: 'idx_alert_subscriptions_user_id on alert_subscriptions(user_id)',
    table: 'alert_subscriptions',
    column: 'user_id',
    files: ['025_rls_index_hardening.sql'],
    pattern: /CREATE INDEX IF NOT EXISTS\s+idx_alert_subscriptions_user_id/i,
    notes: 'partial btree index WHERE user_id IS NOT NULL (migration 025)',
  },
  {
    name: 'idx_flight_watches_user_id on flight_watches(user_id)',
    table: 'flight_watches',
    column: 'user_id',
    files: ['025_rls_index_hardening.sql'],
    pattern: /CREATE INDEX IF NOT EXISTS\s+idx_flight_watches_user_id/i,
    notes: 'btree index from migration 025',
  },
  {
    name: 'idx_onboarding_email_log_unique on onboarding_email_log(user_id, email_kind)',
    table: 'onboarding_email_log',
    column: 'user_id',
    files: ['018_onboarding_email_log.sql'],
    pattern: /CREATE UNIQUE INDEX IF NOT EXISTS\s+idx_onboarding_email_log_unique/i,
    notes: 'composite unique index with user_id as leading column (migration 018)',
  },
]

function readMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename)
  if (!fs.existsSync(filepath)) return null
  return fs.readFileSync(filepath, 'utf-8')
}

function runAudit() {
  let allPass = true
  const results = []

  for (const check of REQUIRED_RLS_INDEXES) {
    const combinedSql = check.files
      .map((f) => readMigration(f) ?? '')
      .join('\n')

    const filesMissing = check.files.filter(
      (f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f))
    )

    let status
    let detail

    if (filesMissing.length > 0) {
      status = 'MISSING_FILE'
      detail = `migration file(s) not found: ${filesMissing.join(', ')}`
      allPass = false
    } else if (check.pattern.test(combinedSql)) {
      status = 'ok'
      detail = check.notes
    } else {
      status = 'MISSING_INDEX'
      detail = `pattern not found in ${check.files.join(', ')}`
      allPass = false
    }

    results.push({ name: check.name, status, detail })
  }

  // Print results table
  console.log('\nRLS Index Coverage Audit')
  console.log('─'.repeat(72))
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : '✗'
    console.log(`${icon} [${r.status.padEnd(12)}] ${r.name}`)
    if (r.status !== 'ok') {
      console.log(`  → ${r.detail}`)
    }
  }
  console.log('─'.repeat(72))

  const passed = results.filter((r) => r.status === 'ok').length
  console.log(`\n${passed}/${results.length} checks passed.\n`)

  if (!allPass) {
    console.error('RLS index audit FAILED — some required indexes are missing.')
    process.exit(1)
  }

  console.log('RLS index audit PASSED — all required indexes are present.')
}

runAudit()
