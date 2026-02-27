#!/usr/bin/env node

import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const TASKS_DIR = path.join(REPO_ROOT, 'agents', 'tasks')
const JOBS_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'supervisor')
const LOGS_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'logs')
const ORCHESTRATOR = path.join(REPO_ROOT, 'scripts', 'agents', 'orchestrator.mjs')

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
  if (!content.startsWith('---\n')) throw new Error('Task file missing YAML frontmatter')
  const end = content.indexOf('\n---\n', 4)
  if (end === -1) throw new Error('Task file has malformed frontmatter')

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

function nowIso() {
  return new Date().toISOString()
}

function toStamp(iso) {
  return iso.replace(/[:.]/g, '-').replace('T', '_')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPidRunning(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

async function ensureLayout() {
  await Promise.all([
    fsp.mkdir(JOBS_DIR, { recursive: true }),
    fsp.mkdir(LOGS_DIR, { recursive: true }),
  ])
}

async function readTaskFile(file) {
  const content = await fsp.readFile(file, 'utf8')
  const parsed = parseTask(content)
  return { file, ...parsed }
}

async function writeTaskFile(task) {
  await fsp.writeFile(task.file, serializeTask(task.meta, task.body), 'utf8')
}

async function listTasks(owner = null) {
  const entries = await fsp.readdir(TASKS_DIR)
  const files = entries
    .filter((name) => /^TASK-\d{4}\.md$/.test(name))
    .sort()

  const rows = []
  for (const name of files) {
    const file = path.join(TASKS_DIR, name)
    const task = await readTaskFile(file)
    if (owner && String(task.meta.owner ?? '').toLowerCase() !== owner) continue
    rows.push(task)
  }
  return rows
}

function summarizeStatuses(tasks) {
  const counts = { pending: 0, in_progress: 0, in_review: 0, done: 0, blocked: 0, canceled: 0, other: 0 }
  for (const task of tasks) {
    const status = String(task.meta.status ?? '')
    if (status in counts) counts[status] += 1
    else counts.other += 1
  }
  return counts
}

function parseOutboxMeta(content) {
  const line = (key) => {
    const m = content.match(new RegExp(`^- ${key}:\\s*(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return {
    timedOut: line('timed_out') === 'true',
    timeoutType: line('timeout_type') || 'none',
  }
}

async function readOutboxMeta(task) {
  const outbox = String(task.meta.last_dispatch_outbox ?? '').trim()
  if (!outbox) return { timedOut: false, timeoutType: 'none' }
  const abs = path.join(REPO_ROOT, outbox)
  try {
    const raw = await fsp.readFile(abs, 'utf8')
    return parseOutboxMeta(raw)
  } catch {
    return { timedOut: false, timeoutType: 'none' }
  }
}

async function runDispatch(owner, statusFilter, timeoutMs, noOutputTimeoutMs, logFile) {
  const args = [ORCHESTRATOR, 'dispatch-all']
  if (owner) args.push('--owner', owner)
  if (statusFilter) args.push('--status', statusFilter)
  if (timeoutMs) args.push('--timeout_ms', String(timeoutMs))
  if (noOutputTimeoutMs) args.push('--no_output_timeout_ms', String(noOutputTimeoutMs))

  return new Promise((resolve) => {
    const out = fs.openSync(logFile, 'a')
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', out, out],
    })
    child.on('exit', (code) => {
      fs.closeSync(out)
      resolve(Number(code ?? 1))
    })
    child.on('error', () => {
      fs.closeSync(out)
      resolve(1)
    })
  })
}

async function readRetryState(file) {
  try {
    const raw = await fsp.readFile(file, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeRetryState(file, state) {
  await fsp.writeFile(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

async function writeHeartbeat(file, payload) {
  await fsp.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function appendEvent(file, payload) {
  await fsp.appendFile(file, `${JSON.stringify(payload)}\n`, 'utf8')
}

async function cmdRun(args) {
  await ensureLayout()
  const jobId = String(args.job_id ?? '').trim()
  if (!jobId) throw new Error('run requires --job_id')

  const owner = args.owner ? String(args.owner).toLowerCase() : null
  const statusFilter = String(args.status ?? 'pending')
  const intervalMs = Number(args.interval_ms ?? 15000)
  const timeoutMs = Number(args.timeout_ms ?? 1200000)
  const noOutputTimeoutMs = Number(args.no_output_timeout_ms ?? 900000)
  const maxBlockedRetries = Number(args.max_blocked_retries ?? 2)

  const heartbeatFile = path.join(JOBS_DIR, `${jobId}.status.json`)
  const retryStateFile = path.join(JOBS_DIR, `${jobId}.retries.json`)
  const eventsFile = path.join(LOGS_DIR, `${jobId}.events.ndjson`)
  const dispatchLogFile = path.join(LOGS_DIR, `${jobId}.dispatch.log`)

  const retries = await readRetryState(retryStateFile)

  while (true) {
    const started = nowIso()
    const tasksBefore = await listTasks(owner)
    const countsBefore = summarizeStatuses(tasksBefore)

    const preHeartbeat = {
      id: jobId,
      at: nowIso(),
      phase: 'dispatching',
      owner: owner ?? 'any',
      status_filter: statusFilter,
      interval_ms: intervalMs,
      timeout_ms: timeoutMs,
      no_output_timeout_ms: noOutputTimeoutMs,
      max_blocked_retries: maxBlockedRetries,
      dispatch_exit_code: null,
      retries_applied: 0,
      counts_before: countsBefore,
      counts_after: null,
      started_at: started,
      finished_at: null,
    }
    await writeHeartbeat(heartbeatFile, preHeartbeat)
    await appendEvent(eventsFile, preHeartbeat)

    const exitCode = await runDispatch(owner, statusFilter, timeoutMs, noOutputTimeoutMs, dispatchLogFile)

    const tasksAfter = await listTasks(owner)
    const countsAfter = summarizeStatuses(tasksAfter)
    const blockedTasks = tasksAfter.filter((task) => String(task.meta.status) === 'blocked')

    let retriesApplied = 0
    for (const task of blockedTasks) {
      const taskId = String(task.meta.id ?? '')
      if (!taskId) continue

      const attempts = Number(retries[taskId] ?? 0)
      if (attempts >= maxBlockedRetries) continue

      const outbox = await readOutboxMeta(task)
      if (!outbox.timedOut || outbox.timeoutType !== 'no_output') continue

      task.meta.status = 'pending'
      task.meta.updated_at = nowIso()
      await writeTaskFile(task)
      retries[taskId] = attempts + 1
      retriesApplied += 1
    }

    if (retriesApplied > 0) {
      await writeRetryState(retryStateFile, retries)
    }

    const heartbeat = {
      id: jobId,
      at: nowIso(),
      phase: 'idle',
      owner: owner ?? 'any',
      status_filter: statusFilter,
      interval_ms: intervalMs,
      timeout_ms: timeoutMs,
      no_output_timeout_ms: noOutputTimeoutMs,
      max_blocked_retries: maxBlockedRetries,
      dispatch_exit_code: exitCode,
      retries_applied: retriesApplied,
      counts_before: countsBefore,
      counts_after: countsAfter,
      started_at: started,
      finished_at: nowIso(),
    }

    await writeHeartbeat(heartbeatFile, heartbeat)
    await appendEvent(eventsFile, heartbeat)
    await sleep(intervalMs)
  }
}

async function cmdStart(args) {
  await ensureLayout()
  const owner = args.owner ? String(args.owner).toLowerCase() : null
  const statusFilter = String(args.status ?? 'pending')
  const intervalMs = Number(args.interval_ms ?? 15000)
  const timeoutMs = Number(args.timeout_ms ?? 1200000)
  const noOutputTimeoutMs = Number(args.no_output_timeout_ms ?? 900000)
  const maxBlockedRetries = Number(args.max_blocked_retries ?? 2)
  const startedAt = nowIso()
  const jobId = `SUP-${toStamp(startedAt)}`
  const logFile = path.join(LOGS_DIR, `${jobId}.log`)

  const existingJobs = (await fsp.readdir(JOBS_DIR))
    .filter((name) => name.endsWith('.json') && !name.endsWith('.status.json') && !name.endsWith('.retries.json'))
    .sort()

  for (const fileName of existingJobs) {
    const file = path.join(JOBS_DIR, fileName)
    try {
      const raw = await fsp.readFile(file, 'utf8')
      const data = JSON.parse(raw)
      if (!data.running) continue
      if (!isPidRunning(Number(data.pid))) continue
      if ((data.owner ?? 'any') !== (owner ?? 'any')) continue
      if (args.allow_parallel) continue
      throw new Error(
        `Supervisor already running for owner=${owner ?? 'any'} (${data.id}). Pass --allow_parallel true to override.`
      )
    } catch (error) {
      if (String(error.message).includes('Supervisor already running')) throw error
    }
  }

  const cliArgs = [
    __filename,
    'run',
    '--job_id',
    jobId,
    '--status',
    statusFilter,
    '--interval_ms',
    String(intervalMs),
    '--timeout_ms',
    String(timeoutMs),
    '--no_output_timeout_ms',
    String(noOutputTimeoutMs),
    '--max_blocked_retries',
    String(maxBlockedRetries),
  ]
  if (owner) cliArgs.push('--owner', owner)

  const fd = fs.openSync(logFile, 'a')
  const child = spawn(process.execPath, cliArgs, {
    cwd: REPO_ROOT,
    env: process.env,
    detached: true,
    stdio: ['ignore', fd, fd],
  })
  child.unref()
  fs.closeSync(fd)

  const job = {
    id: jobId,
    pid: child.pid,
    owner: owner ?? 'any',
    status_filter: statusFilter,
    interval_ms: intervalMs,
    timeout_ms: timeoutMs,
    no_output_timeout_ms: noOutputTimeoutMs,
    max_blocked_retries: maxBlockedRetries,
    started_at: startedAt,
    ended_at: null,
    running: true,
    log_file: path.relative(REPO_ROOT, logFile),
  }
  await fsp.writeFile(path.join(JOBS_DIR, `${jobId}.json`), `${JSON.stringify(job, null, 2)}\n`, 'utf8')

  console.log(`Started ${jobId}`)
  console.log(`pid=${child.pid}`)
  console.log(`log=${path.relative(REPO_ROOT, logFile)}`)
}

async function cmdList() {
  await ensureLayout()
  const entries = (await fsp.readdir(JOBS_DIR))
    .filter((name) => name.endsWith('.json') && !name.endsWith('.status.json') && !name.endsWith('.retries.json'))
    .sort()
    .reverse()

  if (entries.length === 0) {
    console.log('No supervisor jobs found.')
    return
  }

  for (const name of entries) {
    const file = path.join(JOBS_DIR, name)
    const data = JSON.parse(await fsp.readFile(file, 'utf8'))
    const running = isPidRunning(Number(data.pid))
    console.log(`${data.id} | running=${running ? 'yes' : 'no'} | owner=${data.owner} | started=${data.started_at}`)
  }
}

async function cmdStatus(args) {
  const jobId = String(args._[1] ?? '').trim()
  if (!jobId) throw new Error('Usage: status SUP-...')

  const file = path.join(JOBS_DIR, `${jobId}.json`)
  const raw = await fsp.readFile(file, 'utf8')
  const data = JSON.parse(raw)
  const running = isPidRunning(Number(data.pid))
  const heartbeatFile = path.join(JOBS_DIR, `${jobId}.status.json`)
  let heartbeat = null
  try {
    heartbeat = JSON.parse(await fsp.readFile(heartbeatFile, 'utf8'))
  } catch {
    heartbeat = null
  }

  if (!running && data.running) {
    data.running = false
    data.ended_at = nowIso()
    await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }

  console.log(
    JSON.stringify(
      {
        id: data.id,
        running,
        pid: data.pid,
        owner: data.owner,
        status_filter: data.status_filter,
        started_at: data.started_at,
        ended_at: running ? null : (data.ended_at ?? null),
        log_file: data.log_file,
        heartbeat,
      },
      null,
      2
    )
  )
}

async function cmdWatch(args) {
  const jobId = String(args._[1] ?? '').trim()
  if (!jobId) throw new Error('Usage: watch SUP-...')
  const intervalMs = Number(args.interval_ms ?? 5000)
  let lastLine = ''

  while (true) {
    const file = path.join(JOBS_DIR, `${jobId}.json`)
    const data = JSON.parse(await fsp.readFile(file, 'utf8'))
    const running = isPidRunning(Number(data.pid))
    const heartbeatFile = path.join(JOBS_DIR, `${jobId}.status.json`)
    let heartbeat = null
    try {
      heartbeat = JSON.parse(await fsp.readFile(heartbeatFile, 'utf8'))
    } catch {
      heartbeat = null
    }

    const counts = heartbeat?.counts_after ?? {}
    const line = [
      new Date().toISOString(),
      `running=${running ? 'yes' : 'no'}`,
      `pending=${counts.pending ?? '?'}`,
      `in_progress=${counts.in_progress ?? '?'}`,
      `in_review=${counts.in_review ?? '?'}`,
      `blocked=${counts.blocked ?? '?'}`,
      `done=${counts.done ?? '?'}`,
      `retries_applied=${heartbeat?.retries_applied ?? 0}`,
    ].join(' ')

    if (line !== lastLine) {
      console.log(line)
      lastLine = line
    }
    if (!running) break
    await sleep(intervalMs)
  }
}

async function cmdStop(args) {
  const jobId = String(args._[1] ?? '').trim()
  if (!jobId) throw new Error('Usage: stop SUP-...')
  const file = path.join(JOBS_DIR, `${jobId}.json`)
  const raw = await fsp.readFile(file, 'utf8')
  const data = JSON.parse(raw)
  const pid = Number(data.pid)
  if (!isPidRunning(pid)) {
    data.running = false
    data.ended_at = nowIso()
    await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    console.log(`${jobId} is already stopped.`)
    return
  }
  process.kill(pid, 'SIGTERM')
  data.running = false
  data.ended_at = nowIso()
  await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  console.log(`Stopped ${jobId}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0] ?? 'help'

  switch (cmd) {
    case 'start':
      await cmdStart(args)
      return
    case 'run':
      await cmdRun(args)
      return
    case 'list':
      await cmdList(args)
      return
    case 'status':
      await cmdStatus(args)
      return
    case 'watch':
      await cmdWatch(args)
      return
    case 'stop':
      await cmdStop(args)
      return
    case 'help':
    default:
      console.log([
        'Usage:',
        '  node scripts/agents/supervisor.mjs start [--owner kimi] [--status pending] [--interval_ms 15000] [--timeout_ms 1200000] [--no_output_timeout_ms 900000] [--max_blocked_retries 2]',
        '  node scripts/agents/supervisor.mjs list',
        '  node scripts/agents/supervisor.mjs status SUP-...',
        '  node scripts/agents/supervisor.mjs watch SUP-... [--interval_ms 5000]',
        '  node scripts/agents/supervisor.mjs stop SUP-...',
      ].join('\n'))
  }
}

main().catch((error) => {
  console.error(`supervisor error: ${error.message}`)
  process.exit(1)
})
