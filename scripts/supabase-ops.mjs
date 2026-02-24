#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')
const VERIFY_SQL = path.join(ROOT, 'docs', 'sql', 'launch-migration-audit.sql')
const POST_DEPLOY_SQL = path.join(ROOT, 'docs', 'sql', 'post-deploy-smoke.sql')

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

function ensurePsql() {
  const check = spawnSync('psql', ['--version'], { stdio: 'ignore' })
  if (check.status === 0) return
  console.error('psql is required but not found. Install PostgreSQL client tools first.')
  process.exit(1)
}

function runSqlFile(dbUrl, file, label) {
  if (!fs.existsSync(file)) {
    console.error(`SQL file not found: ${file}`)
    process.exit(1)
  }

  console.log(`\n==> ${label}`)
  const result = spawnSync(
    'psql',
    ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', dbUrl, '-f', file],
    { stdio: 'inherit' },
  )

  if (result.status !== 0) {
    console.error(`Failed: ${label}`)
    process.exit(result.status ?? 1)
  }
}

function parseMigrationArg(argValues) {
  const joined = argValues.join(',')
  if (!joined.trim()) {
    return ['009_security_hardening_rls.sql', '010_flight_watches.sql']
  }
  return [...new Set(
    joined
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )]
}

function resolveMigrationFiles(filenames) {
  const available = new Set(fs.readdirSync(MIGRATIONS_DIR))
  const files = []

  for (const name of filenames) {
    if (!available.has(name)) {
      console.error(`Unknown migration file: ${name}`)
      process.exit(1)
    }
    files.push(path.join(MIGRATIONS_DIR, name))
  }
  return files
}

function printUsage() {
  console.log(`Usage:
  node scripts/supabase-ops.mjs verify
  node scripts/supabase-ops.mjs postcheck
  node scripts/supabase-ops.mjs apply [migration1.sql,migration2.sql]
  node scripts/supabase-ops.mjs sync [migration1.sql,migration2.sql]

Env:
  SUPABASE_DB_URL (required) - direct Postgres connection string
`)
}

function main() {
  loadDotEnv(path.join(ROOT, '.env.local'))
  loadDotEnv(path.join(ROOT, '.env'))

  const command = process.argv[2] ?? ''
  const argValues = process.argv.slice(3)
  const dbUrl = process.env.SUPABASE_DB_URL?.trim()

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage()
    process.exit(0)
  }

  if (!dbUrl) {
    console.error('SUPABASE_DB_URL is required. Add it to .env.local or export it in shell.')
    process.exit(1)
  }

  ensurePsql()

  if (command === 'verify') {
    runSqlFile(dbUrl, VERIFY_SQL, 'Migration audit (001-010)')
    return
  }

  if (command === 'postcheck') {
    runSqlFile(dbUrl, POST_DEPLOY_SQL, 'Post-deploy smoke SQL checks')
    return
  }

  if (command === 'apply' || command === 'sync') {
    const requested = parseMigrationArg(argValues)
    const files = resolveMigrationFiles(requested)
    for (const file of files) {
      runSqlFile(dbUrl, file, `Applying ${path.basename(file)}`)
    }
    if (command === 'sync') {
      runSqlFile(dbUrl, VERIFY_SQL, 'Migration audit (001-010)')
    }
    return
  }

  console.error(`Unknown command: ${command}`)
  printUsage()
  process.exit(1)
}

main()
