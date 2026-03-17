#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')
const MIGRATION_RE = /^(\d{3})_(.+)\.sql$/

function fail(message) {
  console.error(message)
  process.exit(1)
}

function readLocalMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const match = filename.match(MIGRATION_RE)
      if (!match) {
        fail(`Invalid migration filename: ${filename}. Expected NNN_description.sql`)
      }

      return {
        filename,
        ordinal: Number.parseInt(match[1], 10),
      }
    })
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

function readBaseMigrations(baseSha) {
  const output = runGit(['ls-tree', '-r', '--name-only', baseSha, 'supabase/migrations'])
  if (!output) return []

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filepath) => path.basename(filepath))
    .filter((filename) => filename.endsWith('.sql'))
    .map((filename) => {
      const match = filename.match(MIGRATION_RE)
      if (!match) return null
      return {
        filename,
        ordinal: Number.parseInt(match[1], 10),
      }
    })
    .filter((row) => row !== null)
}

function readAddedMigrationFiles(baseSha, headSha) {
  const output = runGit(['diff', '--name-status', '--diff-filter=AR', baseSha, headSha, '--', 'supabase/migrations'])
  if (!output) return []

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .map((parts) => {
      const status = parts[0] ?? ''
      if (status.startsWith('R')) return parts[2] ?? null
      return parts[1] ?? null
    })
    .filter((filepath) => typeof filepath === 'string' && filepath.endsWith('.sql'))
    .map((filepath) => path.basename(filepath))
}

function ensureLocalOrdering(rows) {
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1]
    const current = rows[index]
    if (current.ordinal < previous.ordinal) {
      fail(`Migration order regressed: ${current.filename} appears after ${previous.filename}`)
    }
  }
}

function describeOrdinals(rows) {
  return rows.map((row) => `${row.filename} (${row.ordinal})`).join(', ')
}

const localMigrations = readLocalMigrations()
ensureLocalOrdering(localMigrations)

const duplicateOrdinals = new Map()
for (const row of localMigrations) {
  const bucket = duplicateOrdinals.get(row.ordinal) ?? []
  bucket.push(row.filename)
  duplicateOrdinals.set(row.ordinal, bucket)
}

const legacyDuplicates = [...duplicateOrdinals.entries()]
  .filter(([, filenames]) => filenames.length > 1)
  .map(([ordinal, filenames]) => ({ ordinal, filenames }))

if (legacyDuplicates.length > 0) {
  console.warn(
    `Legacy duplicate migration ordinals detected: ${legacyDuplicates
      .map(({ ordinal, filenames }) => `${ordinal}: ${filenames.join(', ')}`)
      .join(' | ')}`,
  )
}

const baseSha = process.env.BASE_SHA?.trim()
const headSha = process.env.HEAD_SHA?.trim() || 'HEAD'

if (!baseSha) {
  console.log(`Migration policy OK (${localMigrations.length} files checked locally).`)
  process.exit(0)
}

const baseMigrations = readBaseMigrations(baseSha)
const addedFiles = new Set(readAddedMigrationFiles(baseSha, headSha))
const addedRows = localMigrations.filter((row) => addedFiles.has(row.filename))

if (addedRows.length === 0) {
  console.log(`Migration policy OK (${localMigrations.length} files checked, no new migrations in diff).`)
  process.exit(0)
}

const maxBaseOrdinal = baseMigrations.reduce((max, row) => Math.max(max, row.ordinal), 0)
const sortedAddedRows = [...addedRows].sort((left, right) => left.ordinal - right.ordinal || left.filename.localeCompare(right.filename))

for (let index = 0; index < sortedAddedRows.length; index += 1) {
  const row = sortedAddedRows[index]
  const expectedOrdinal = maxBaseOrdinal + index + 1
  if (row.ordinal !== expectedOrdinal) {
    fail(
      `New migrations must continue from ${String(maxBaseOrdinal).padStart(3, '0')} with no gaps or duplicates. `
      + `Expected ${String(expectedOrdinal).padStart(3, '0')}, got ${row.filename}. `
      + `New files: ${describeOrdinals(sortedAddedRows)}`,
    )
  }
}

console.log(
  `Migration policy OK (${localMigrations.length} files checked, new migrations continue from `
  + `${String(maxBaseOrdinal).padStart(3, '0')}).`,
)
