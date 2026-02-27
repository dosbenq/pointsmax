#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const AGENTS_ROOT = path.join(REPO_ROOT, 'agents')
const TASKS_DIR = path.join(AGENTS_ROOT, 'tasks')
const OUTBOX_DIR = path.join(AGENTS_ROOT, 'outbox')
const RUNTIME_DIR = path.join(AGENTS_ROOT, 'runtime')
const PROMPTS_DIR = path.join(RUNTIME_DIR, 'prompts')
const LOGS_DIR = path.join(RUNTIME_DIR, 'logs')
const CONFIG_PATH = path.join(AGENTS_ROOT, 'config', 'agents.json')

const VALID_STATUSES = new Set(['pending', 'in_progress', 'in_review', 'done', 'blocked', 'canceled'])
const VALID_OWNERS = new Set(['claude', 'gemini', 'kimi', 'codex'])

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function ensureLayout() {
  await Promise.all([
    ensureDir(TASKS_DIR),
    ensureDir(OUTBOX_DIR),
    ensureDir(PROMPTS_DIR),
    ensureDir(LOGS_DIR),
    ensureDir(path.dirname(CONFIG_PATH)),
  ])
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      out._.push(token)
      continue
    }

    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      out[key] = true
      continue
    }

    out[key] = next
    i += 1
  }
  return out
}

function nowIso() {
  return new Date().toISOString()
}

function todayStamp() {
  return nowIso().replace(/[:.]/g, '-').replace('T', '_')
}

function parseScalar(raw) {
  const value = String(raw).trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10)
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return value
    }
  }
  return value
}

function parseTask(content) {
  if (!content.startsWith('---\n')) {
    throw new Error('Task file missing YAML frontmatter')
  }
  const end = content.indexOf('\n---\n', 4)
  if (end === -1) {
    throw new Error('Task file has malformed frontmatter')
  }

  const fm = content.slice(4, end).trim()
  const body = content.slice(end + 5).trimStart()
  const meta = {}

  for (const line of fm.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const rawValue = line.slice(idx + 1).trim()
    meta[key] = parseScalar(rawValue)
  }

  return { meta, body }
}

function serializeTask(meta, body) {
  const keys = [
    'id',
    'title',
    'owner',
    'status',
    'priority',
    'created_at',
    'updated_at',
    'depends_on',
    'last_dispatch_at',
    'last_dispatch_outbox',
  ]

  const lines = []
  for (const key of keys) {
    if (!(key in meta) || meta[key] === undefined || meta[key] === '') continue
    const value = meta[key]
    if (Array.isArray(value)) {
      lines.push(`${key}: ${JSON.stringify(value)}`)
      continue
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`${key}: ${String(value)}`)
      continue
    }
    lines.push(`${key}: ${String(value)}`)
  }

  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`
}

async function readTask(taskId) {
  const file = path.join(TASKS_DIR, `${taskId}.md`)
  const content = await fs.readFile(file, 'utf8')
  const parsed = parseTask(content)
  return { file, ...parsed }
}

async function writeTask(file, meta, body) {
  const serialized = serializeTask(meta, body)
  await fs.writeFile(file, serialized, 'utf8')
}

async function listTaskIds() {
  const entries = await fs.readdir(TASKS_DIR)
  return entries
    .filter((name) => /^TASK-\d{4}\.md$/.test(name))
    .map((name) => name.replace(/\.md$/, ''))
    .sort()
}

async function getNextTaskId() {
  const ids = await listTaskIds()
  const max = ids.reduce((acc, id) => {
    const n = Number.parseInt(id.split('-')[1], 10)
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `TASK-${String(max + 1).padStart(4, '0')}`
}

function shellEscape(input) {
  return `'${String(input).replace(/'/g, `'"'"'`)}'`
}

function renderTemplate(template, vars) {
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    if (!(k in vars)) return ''
    return String(vars[k])
  })
}

function buildTaskBody(input) {
  const objective = input.objective ?? 'TBD'
  const scope = input.scope ?? 'TBD'
  const criteriaRaw = input.criteria ?? input.acceptance ?? 'TBD'
  const criteria = String(criteriaRaw)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)

  const criteriaLines = criteria.length > 0
    ? criteria.map((c) => `- ${c}`).join('\n')
    : '- TBD'

  return [
    '## Objective',
    objective,
    '',
    '## Scope',
    scope,
    '',
    '## Acceptance Criteria',
    criteriaLines,
    '',
    '## Notes',
    input.notes ?? '',
    '',
  ].join('\n')
}

async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8')
  return JSON.parse(raw)
}

async function writeDefaultConfig() {
  const defaultConfig = {
    default_timeout_ms: 900000,
    agents: {
      claude: {
        enabled: true,
        shell: 'claude -p "$(cat {{prompt_file}})"',
        timeout_ms: 900000,
      },
      gemini: {
        enabled: true,
        shell: 'gemini -p "$(cat {{prompt_file}})"',
        timeout_ms: 900000,
      },
      kimi: {
        enabled: true,
        shell: 'kimi -p "$(cat {{prompt_file}})"',
        timeout_ms: 900000,
      },
      codex: {
        enabled: true,
        shell: 'codex run "$(cat {{prompt_file}})"',
        timeout_ms: 900000,
      },
    },
  }
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8')
}

async function cmdInit() {
  await ensureLayout()
  try {
    await fs.access(CONFIG_PATH)
  } catch {
    await writeDefaultConfig()
  }

  console.log('Agent orchestration initialized')
  console.log(`- config: ${path.relative(REPO_ROOT, CONFIG_PATH)}`)
  console.log(`- tasks: ${path.relative(REPO_ROOT, TASKS_DIR)}`)
  console.log(`- outbox: ${path.relative(REPO_ROOT, OUTBOX_DIR)}`)
}

async function cmdCreate(args) {
  await ensureLayout()

  const owner = String(args.owner ?? '').toLowerCase()
  if (!VALID_OWNERS.has(owner)) {
    throw new Error('Missing or invalid --owner (claude|gemini|kimi|codex)')
  }

  const title = String(args.title ?? '').trim()
  if (!title) {
    throw new Error('Missing --title')
  }

  const taskId = await getNextTaskId()
  const file = path.join(TASKS_DIR, `${taskId}.md`)
  const createdAt = nowIso()

  const meta = {
    id: taskId,
    title,
    owner,
    status: 'pending',
    priority: args.priority ?? 'p2',
    created_at: createdAt,
    updated_at: createdAt,
    depends_on: [],
  }

  const body = buildTaskBody(args)
  await writeTask(file, meta, body)

  console.log(`Created ${taskId}`)
  console.log(path.relative(REPO_ROOT, file))
}

async function cmdList(args) {
  await ensureLayout()
  const ids = await listTaskIds()
  if (ids.length === 0) {
    console.log('No tasks found.')
    return
  }

  const filterStatus = args.status ? String(args.status) : null
  const filterOwner = args.owner ? String(args.owner).toLowerCase() : null

  const rows = []
  for (const id of ids) {
    const task = await readTask(id)
    const meta = task.meta
    if (filterStatus && meta.status !== filterStatus) continue
    if (filterOwner && meta.owner !== filterOwner) continue
    rows.push({
      id,
      owner: meta.owner ?? '-',
      status: meta.status ?? '-',
      priority: meta.priority ?? '-',
      title: meta.title ?? '-',
      updated: meta.updated_at ?? '-',
    })
  }

  if (rows.length === 0) {
    console.log('No tasks match filter.')
    return
  }

  for (const row of rows) {
    console.log(`${row.id} | ${row.owner} | ${row.status} | ${row.priority} | ${row.title}`)
  }
}

async function cmdShow(args) {
  const taskId = String(args._[1] ?? '').trim()
  if (!taskId) throw new Error('Usage: show TASK-0001')

  const task = await readTask(taskId)
  console.log(serializeTask(task.meta, task.body))
}

async function cmdSetStatus(args) {
  const taskId = String(args._[1] ?? '').trim()
  const nextStatus = String(args._[2] ?? '').trim()

  if (!taskId || !nextStatus) {
    throw new Error('Usage: set-status TASK-0001 done')
  }
  if (!VALID_STATUSES.has(nextStatus)) {
    throw new Error(`Invalid status: ${nextStatus}`)
  }

  const task = await readTask(taskId)
  task.meta.status = nextStatus
  task.meta.updated_at = nowIso()
  await writeTask(task.file, task.meta, task.body)
  console.log(`Updated ${taskId} -> ${nextStatus}`)
}

async function runShell(command, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn('zsh', ['-lc', command], { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr, timedOut })
    })
  })
}

async function dispatchOne(taskId, args = {}) {
  await ensureLayout()
  const config = await loadConfig()
  const task = await readTask(taskId)
  const owner = String(task.meta.owner ?? '').toLowerCase()

  if (!VALID_OWNERS.has(owner)) {
    throw new Error(`Task ${taskId} has invalid owner '${owner}'`)
  }

  const agentCfg = config.agents?.[owner]
  if (!agentCfg) {
    throw new Error(`No config for owner '${owner}' in ${path.relative(REPO_ROOT, CONFIG_PATH)}`)
  }
  if (!agentCfg.enabled) {
    throw new Error(`Owner '${owner}' is disabled in config`) 
  }

  const promptContent = [
    `You are ${owner}. Execute this task in repo: ${REPO_ROOT}`,
    'Follow acceptance criteria exactly. Return: summary, changed files, commands run, risks.',
    '',
    '--- TASK START ---',
    serializeTask(task.meta, task.body),
    '--- TASK END ---',
    '',
  ].join('\n')

  const promptFile = path.join(PROMPTS_DIR, `${taskId}.${todayStamp()}.prompt.md`)
  await fs.writeFile(promptFile, promptContent, 'utf8')

  const vars = {
    task_id: taskId,
    task_file: shellEscape(task.file),
    prompt_file: shellEscape(promptFile),
    repo_root: shellEscape(REPO_ROOT),
    outbox_dir: shellEscape(path.join(OUTBOX_DIR, owner)),
  }

  const overrideKey = `AGENT_CMD_${owner.toUpperCase()}`
  const shellTemplate = process.env[overrideKey] || agentCfg.shell
  const renderedCommand = renderTemplate(shellTemplate, vars)
  const dryRun = Boolean(args['dry-run'])

  const timeoutMs = Number(args.timeout_ms ?? agentCfg.timeout_ms ?? config.default_timeout_ms ?? 900000)
  const outboxOwnerDir = path.join(OUTBOX_DIR, owner)
  await ensureDir(outboxOwnerDir)

  const outboxFile = path.join(outboxOwnerDir, `${taskId}.${todayStamp()}.md`)

  if (dryRun) {
    console.log(`Dry run for ${taskId} (${owner})`)
    console.log(renderedCommand)
    return { status: 'pending', outboxFile: null }
  }

  task.meta.status = 'in_progress'
  task.meta.updated_at = nowIso()
  await writeTask(task.file, task.meta, task.body)

  const startedAt = Date.now()
  const execResult = await runShell(renderedCommand, REPO_ROOT, timeoutMs)
  const durationMs = Date.now() - startedAt

  const status = execResult.code === 0 && !execResult.timedOut ? 'in_review' : 'blocked'

  const outboxText = [
    `# ${taskId} · ${owner} run`,
    '',
    `- status: ${status}`,
    `- exit_code: ${execResult.code}`,
    `- timed_out: ${execResult.timedOut ? 'true' : 'false'}`,
    `- duration_ms: ${durationMs}`,
    `- ran_at: ${nowIso()}`,
    `- command: ${renderedCommand}`,
    '',
    '## stdout',
    '```text',
    execResult.stdout.trimEnd(),
    '```',
    '',
    '## stderr',
    '```text',
    execResult.stderr.trimEnd(),
    '```',
    '',
  ].join('\n')

  await fs.writeFile(outboxFile, outboxText, 'utf8')

  task.meta.status = status
  task.meta.updated_at = nowIso()
  task.meta.last_dispatch_at = nowIso()
  task.meta.last_dispatch_outbox = path.relative(REPO_ROOT, outboxFile)
  await writeTask(task.file, task.meta, task.body)

  console.log(`Dispatched ${taskId} -> ${owner}`)
  console.log(`status: ${status}`)
  console.log(`outbox: ${path.relative(REPO_ROOT, outboxFile)}`)

  return { status, outboxFile }
}

async function cmdDispatch(args) {
  const taskId = String(args._[1] ?? '').trim()
  if (!taskId) throw new Error('Usage: dispatch TASK-0001')
  await dispatchOne(taskId, args)
}

async function cmdDispatchAll(args) {
  await ensureLayout()
  const ids = await listTaskIds()
  const filterOwner = args.owner ? String(args.owner).toLowerCase() : null
  const filterStatus = args.status ? String(args.status) : 'pending'
  const limit = args.max ? Number.parseInt(String(args.max), 10) : Number.POSITIVE_INFINITY

  let dispatched = 0
  for (const id of ids) {
    if (dispatched >= limit) break
    const task = await readTask(id)
    const owner = String(task.meta.owner ?? '').toLowerCase()
    const status = String(task.meta.status ?? '')

    if (filterOwner && owner !== filterOwner) continue
    if (filterStatus && status !== filterStatus) continue

    await dispatchOne(id, args)
    dispatched += 1
  }

  console.log(`Dispatch complete. count=${dispatched}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0] ?? 'help'

  switch (cmd) {
    case 'init':
      await cmdInit()
      return
    case 'create':
      await cmdCreate(args)
      return
    case 'list':
      await cmdList(args)
      return
    case 'show':
      await cmdShow(args)
      return
    case 'set-status':
      await cmdSetStatus(args)
      return
    case 'dispatch':
      await cmdDispatch(args)
      return
    case 'dispatch-all':
      await cmdDispatchAll(args)
      return
    case 'help':
    default:
      console.log([
        'Usage:',
        '  node scripts/agents/orchestrator.mjs init',
        '  node scripts/agents/orchestrator.mjs create --owner gemini --title "Fix X" --objective "..." --scope "..." --criteria "a;b;c"',
        '  node scripts/agents/orchestrator.mjs list [--status pending] [--owner gemini]',
        '  node scripts/agents/orchestrator.mjs show TASK-0001',
        '  node scripts/agents/orchestrator.mjs set-status TASK-0001 done',
        '  node scripts/agents/orchestrator.mjs dispatch TASK-0001',
        '  node scripts/agents/orchestrator.mjs dispatch-all [--owner gemini] [--status pending] [--max 2]',
        '  node scripts/agents/orchestrator.mjs dispatch TASK-0001 --dry-run',
        '',
        'Environment overrides:',
        '  AGENT_CMD_CLAUDE, AGENT_CMD_GEMINI, AGENT_CMD_KIMI, AGENT_CMD_CODEX',
      ].join('\n'))
  }
}

main().catch((error) => {
  console.error(`orchestrator error: ${error.message}`)
  process.exit(1)
})
