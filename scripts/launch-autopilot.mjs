#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()

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

function parseArgs(argv) {
  const flags = new Set()
  const values = new Map()

  for (const arg of argv) {
    if (arg.startsWith('--') && arg.includes('=')) {
      const [key, value] = arg.split('=', 2)
      values.set(key, value)
      continue
    }
    if (arg.startsWith('--')) {
      flags.add(arg)
      continue
    }
  }

  return { flags, values }
}

function printUsage() {
  console.log(`Usage:
  node scripts/launch-autopilot.mjs [--quick] [--apply-migrations] [--migrations=009_security_hardening_rls.sql,010_flight_watches.sql]
  node scripts/launch-autopilot.mjs --quick --skip-db

Options:
  --quick              Skip lint/test/build
  --apply-migrations   Apply migration(s) before checks
  --migrations=...     Comma-separated migration filenames (used with --apply-migrations)
  --skip-db            Skip supabase verify/postcheck and migration apply steps
  --skip-smoke         Skip production HTTP smoke checks
  --skip-watchdog      Skip automation watchdog checks
  --help               Show this help
`)
}

function runStep(step, options = {}) {
  const { cmd, args, requiredEnv = [] } = step
  const missing = requiredEnv.filter((key) => !process.env[key] || !process.env[key].trim())
  if (missing.length > 0) {
    console.error(`\n[SKIP] ${step.name}`)
    console.error(`  Missing required env: ${missing.join(', ')}`)
    if (options.failOnMissingEnv) {
      process.exit(1)
    }
    return { skipped: true, ok: false }
  }

  console.log(`\n[RUN ] ${step.name}`)
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.status !== 0) {
    console.error(`[FAIL] ${step.name}`)
    process.exit(result.status ?? 1)
  }

  console.log(`[PASS] ${step.name}`)
  return { skipped: false, ok: true }
}

function main() {
  loadDotEnv(path.join(ROOT, '.env.local'))
  loadDotEnv(path.join(ROOT, '.env'))

  const { flags, values } = parseArgs(process.argv.slice(2))
  if (flags.has('--help')) {
    printUsage()
    return
  }

  const quick = flags.has('--quick')
  const applyMigrations = flags.has('--apply-migrations')
  const skipDb = flags.has('--skip-db')
  const skipSmoke = flags.has('--skip-smoke')
  const skipWatchdog = flags.has('--skip-watchdog')
  const migrationsCsv = values.get('--migrations') ?? ''

  if ((!process.env.BASE_URL || !process.env.BASE_URL.trim()) && process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    process.env.BASE_URL = process.env.NEXT_PUBLIC_APP_URL.trim()
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const nodeCmd = process.execPath

  const steps = []

  steps.push({
    name: 'Launch env audit',
    cmd: npmCmd,
    args: ['run', 'check:launch-env'],
  })

  if (applyMigrations && !skipDb) {
    const migrationArg = migrationsCsv.trim()
      ? migrationCsvToArg(migrationsCsv)
      : ''
    steps.push({
      name: migrationArg
        ? `Apply selected Supabase migrations (${migrationArg})`
        : 'Apply default Supabase migrations (009_security_hardening_rls.sql, 010_flight_watches.sql)',
      cmd: nodeCmd,
      args: migrationArg
        ? ['scripts/supabase-ops.mjs', 'apply', migrationArg]
        : ['scripts/supabase-ops.mjs', 'apply'],
      requiredEnv: ['SUPABASE_DB_URL'],
    })
  }

  if (!skipDb) {
    steps.push({
      name: 'Supabase migration/security audit',
      cmd: npmCmd,
      args: ['run', 'supabase:verify'],
      requiredEnv: ['SUPABASE_DB_URL'],
    })
  }

  if (!quick) {
    steps.push(
      { name: 'Lint', cmd: npmCmd, args: ['run', 'lint'] },
      { name: 'Unit + integration tests', cmd: npmCmd, args: ['test'] },
      { name: 'Production build', cmd: npmCmd, args: ['run', 'build'] },
    )
  }

  if (!skipSmoke) {
    steps.push({
      name: 'Production HTTP/API smoke',
      cmd: npmCmd,
      args: ['run', 'smoke:prod'],
      requiredEnv: ['BASE_URL', 'CRON_SECRET'],
    })
  }

  if (!skipWatchdog) {
    steps.push({
      name: 'Automation watchdog (speed + cron + agents)',
      cmd: npmCmd,
      args: ['run', 'ops:watchdog'],
      requiredEnv: ['BASE_URL', 'CRON_SECRET'],
    })
  }

  if (!skipDb) {
    steps.push({
      name: 'Supabase post-deploy DB checks',
      cmd: npmCmd,
      args: ['run', 'supabase:postcheck'],
      requiredEnv: ['SUPABASE_DB_URL'],
    })
  }

  for (const step of steps) {
    runStep(step, { failOnMissingEnv: true })
  }

  console.log('\nAutopilot completed successfully.')
}

function migrationCsvToArg(raw) {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',')
}

main()
