#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUTPUT_FILE = path.join(ROOT, 'Documentation/PM_PROJECT_DOSSIER.md')
const CHECK_MODE = process.argv.includes('--check')

async function walkFiles(dir, predicate, out = []) {
  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walkFiles(abs, predicate, out)
      continue
    }
    if (predicate(abs)) out.push(abs)
  }
  return out
}

function toPosix(value) {
  return value.replaceAll(path.sep, '/')
}

function normalizeSegment(segment) {
  const match = segment.match(/^\[(.+)\]$/)
  if (!match) return segment
  return `{${match[1]}}`
}

function pageRouteFromFile(file) {
  const rel = toPosix(path.relative(path.join(ROOT, 'src/app'), file))
  if (rel === 'page.tsx') return '/'
  const noSuffix = rel.replace(/\/page\.tsx$/, '')
  return `/${noSuffix.split('/').map(normalizeSegment).join('/')}`
}

function apiRouteFromFile(file) {
  const rel = toPosix(path.relative(path.join(ROOT, 'src/app/api'), file))
  const noSuffix = rel.replace(/\/route\.ts$/, '')
  return `/api/${noSuffix.split('/').map(normalizeSegment).join('/')}`
}

async function getRouteMethods(file) {
  const content = await fs.readFile(file, 'utf8')
  const methods = new Set()
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g
  let match = re.exec(content)
  while (match) {
    methods.add(match[1])
    match = re.exec(content)
  }
  return methods.size > 0 ? [...methods] : ['UNKNOWN']
}

function parseWorkflowTriggers(content) {
  const triggers = []
  const known = ['push', 'pull_request', 'workflow_dispatch', 'workflow_call', 'schedule']
  for (const key of known) {
    if (new RegExp(`\\n\\s*${key}:`).test(`\n${content}`)) triggers.push(key)
  }
  return triggers
}

function parseMigrationMeta(filename) {
  const m = filename.match(/^(\d+)_/)
  return {
    filename,
    ordinal: m ? Number.parseInt(m[1], 10) : null,
  }
}

async function collectEnvGroups() {
  const file = path.join(ROOT, '.env.local.example')
  const content = await fs.readFile(file, 'utf8')
  const lines = content.split('\n')
  const groups = []
  let current = { name: 'Ungrouped', vars: [] }
  let commentBlock = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('#')) {
      commentBlock.push(trimmed)
      if (trimmed.startsWith('# ──')) {
        const name = trimmed.replace(/^#\s*/, '').replace(/[─-]/g, '').trim()
        if (current.vars.length > 0 || current.name !== 'Ungrouped') groups.push(current)
        current = { name, vars: [] }
      }
      continue
    }

    if (!trimmed) {
      commentBlock = []
      continue
    }

    if (/^[A-Z0-9_]+=/.test(trimmed)) {
      const name = trimmed.split('=')[0]
      const optional = commentBlock.some((comment) => /optional/i.test(comment))
      current.vars.push({
        name,
        optional,
      })
      commentBlock = []
    }
  }

  groups.push(current)
  return groups.filter((group) => group.vars.length > 0)
}

async function main() {
  const pages = (await walkFiles(path.join(ROOT, 'src/app'), (f) => f.endsWith('/page.tsx'))).sort()
  const apiRoutes = (await walkFiles(path.join(ROOT, 'src/app/api'), (f) => f.endsWith('/route.ts'))).sort()
  const tests = (await walkFiles(path.join(ROOT, 'src'), (f) => /\.test\.(ts|tsx)$/.test(f))).sort()
  const migrations = (await walkFiles(path.join(ROOT, 'supabase/migrations'), (f) => f.endsWith('.sql'))).sort()
  const workflows = (await walkFiles(path.join(ROOT, '.github/workflows'), (f) => f.endsWith('.yml'))).sort()
  const featureFiles = (await walkFiles(path.join(ROOT, 'src/features'), (f) => /\.(ts|tsx)$/.test(f))).sort()
  const tsFiles = (await walkFiles(path.join(ROOT, 'src'), (f) => /\.(ts|tsx)$/.test(f))).sort()
  const envGroups = await collectEnvGroups()

  const pageRows = pages.map((file) => {
    const route = pageRouteFromFile(file)
    const category = route.startsWith('/admin')
      ? 'Admin'
      : route.startsWith('/profile')
        ? 'Profile'
        : 'User'
    return {
      route,
      category,
      file: toPosix(path.relative(ROOT, file)),
    }
  })

  const apiRows = []
  for (const file of apiRoutes) {
    const methods = await getRouteMethods(file)
    apiRows.push({
      route: apiRouteFromFile(file),
      methods: methods.join(', '),
      file: toPosix(path.relative(ROOT, file)),
    })
  }

  const migrationRows = migrations.map((file) => parseMigrationMeta(path.basename(file)))
  const ordinals = migrationRows.map((row) => row.ordinal).filter((n) => Number.isFinite(n))
  const duplicates = [...new Set(ordinals.filter((n, i) => ordinals.indexOf(n) !== i))]

  const workflowRows = []
  for (const file of workflows) {
    const rel = toPosix(path.relative(ROOT, file))
    const content = await fs.readFile(file, 'utf8')
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    workflowRows.push({
      name: nameMatch ? nameMatch[1].trim() : path.basename(file),
      triggers: parseWorkflowTriggers(content).join(', ') || 'n/a',
      file: rel,
    })
  }

  const scripts = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')).scripts || {}
  const scriptRows = Object.entries(scripts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, cmd]) => ({ name, cmd }))

  const largeFiles = []
  for (const file of tsFiles) {
    const content = await fs.readFile(file, 'utf8')
    const lines = content.split('\n').length
    if (lines >= 500) {
      largeFiles.push({
        file: toPosix(path.relative(ROOT, file)),
        lines,
      })
    }
  }
  largeFiles.sort((a, b) => b.lines - a.lines)

  const gitSha = safeExec('git rev-parse --short HEAD') || 'unknown'
  const gitBranch = safeExec('git rev-parse --abbrev-ref HEAD') || 'unknown'
  const doc = [
    '# PM Project Dossier (Auto-Generated)',
    '',
    '> Source of truth for PM onboarding and status. Generated by `npm run pm:dossier:sync`.',
    '> Do not edit manually; regenerate after every change.',
    '',
    `- Git branch: \`${gitBranch}\``,
    `- Git commit: \`${gitSha}\``,
    '',
    '## 1. Executive Snapshot',
    '',
    `- User-facing pages: **${pageRows.length}**`,
    `- API routes: **${apiRows.length}**`,
    `- Supabase migrations: **${migrationRows.length}**`,
    `- Test files: **${tests.length}**`,
    `- GitHub workflows: **${workflowRows.length}**`,
    `- Feature-slice files: **${featureFiles.length}**`,
    `- NPM scripts: **${scriptRows.length}**`,
    '',
    '## 2. Product Surface (Pages)',
    '',
    '| Route | Category | File |',
    '|---|---|---|',
    ...pageRows.map((row) => `| \`${row.route}\` | ${row.category} | \`${row.file}\` |`),
    '',
    '## 3. API Surface',
    '',
    '| Route | Methods | File |',
    '|---|---|---|',
    ...apiRows.map((row) => `| \`${row.route}\` | \`${row.methods}\` | \`${row.file}\` |`),
    '',
    '## 4. Data Layer (Supabase Migrations)',
    '',
    duplicates.length > 0
      ? `- Warning: duplicate migration ordinals detected: ${duplicates.map((n) => `\`${n}\``).join(', ')}`
      : '- Migration ordinal scan: no duplicate ordinals detected.',
    '',
    '| # | Migration file |',
    '|---|---|',
    ...migrationRows.map((row) => `| ${row.ordinal ?? 'n/a'} | \`${row.filename}\` |`),
    '',
    '## 5. Integrations and Environment Variables',
    '',
    ...envGroups.flatMap((group) => [
      `### ${group.name}`,
      '',
      '| Variable | Required |',
      '|---|---|',
      ...group.vars.map((v) => `| \`${v.name}\` | ${v.optional ? 'No' : 'Yes'} |`),
      '',
    ]),
    '## 6. CI/CD and Operations Workflows',
    '',
    '| Workflow | Triggers | File |',
    '|---|---|---|',
    ...workflowRows.map((row) => `| ${row.name} | \`${row.triggers}\` | \`${row.file}\` |`),
    '',
    '## 7. Engineering Commands',
    '',
    '| Script | Command |',
    '|---|---|',
    ...scriptRows.map((row) => `| \`${row.name}\` | \`${row.cmd.replaceAll('|', '\\|')}\` |`),
    '',
    '## 8. Test Inventory',
    '',
    '| Test file |',
    '|---|',
    ...tests.map((file) => `| \`${toPosix(path.relative(ROOT, file))}\` |`),
    '',
    '## 9. Maintainability Hotspots (>= 500 LOC)',
    '',
    largeFiles.length === 0
      ? '- None.'
      : '| File | LOC |',
    ...(largeFiles.length === 0 ? [] : ['|---|---|', ...largeFiles.map((row) => `| \`${row.file}\` | ${row.lines} |`)]),
    '',
    '## 10. PM Operational Playbook',
    '',
    '- Source docs:',
    '  - `README.md`',
    '  - `Documentation/launch-day-runbook.md`',
    '  - `Documentation/launch-readiness.md`',
    '  - `Documentation/engineering/01-architecture.md`',
    '- Core PM commands:',
    '  - `npm run pm:dossier:sync`',
    '  - `npm run pm:dossier:check`',
    '  - `npm run quality:gates`',
    '  - `npm run test -- --run`',
    '  - `npm run build`',
    '',
    '## 11. Update Policy (Mandatory)',
    '',
    '1. Every behavior, API, schema, workflow, or env-var change must regenerate this dossier.',
    '2. CI blocks merges when this file is stale (`npm run pm:dossier:check`).',
    '3. PR reviewers must verify the "PM dossier freshness" check is green before approval.',
    '',
  ].join('\n')

  if (CHECK_MODE) {
    let existing = ''
    try {
      existing = await fs.readFile(OUTPUT_FILE, 'utf8')
    } catch {
      console.error(`Missing dossier file: ${toPosix(path.relative(ROOT, OUTPUT_FILE))}`)
      console.error('Run: npm run pm:dossier:sync')
      process.exit(1)
    }
    if (existing !== doc) {
      console.error('PM dossier is stale. Run: npm run pm:dossier:sync')
      process.exit(1)
    }
    console.log('PM dossier check passed')
    return
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
  await fs.writeFile(OUTPUT_FILE, doc, 'utf8')
  console.log(`Wrote ${toPosix(path.relative(ROOT, OUTPUT_FILE))}`)
}

function safeExec(command) {
  try {
    return execSync(command, { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
