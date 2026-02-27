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
const RUNTIME_DIR = path.join(REPO_ROOT, 'agents', 'runtime')
const JOBS_DIR = path.join(RUNTIME_DIR, 'jobs')
const LOGS_DIR = path.join(RUNTIME_DIR, 'logs')
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
  const meta = {}
  for (const line of fm.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const rawValue = line.slice(idx + 1).trim()
    meta[key] = parseScalar(rawValue)
  }
  return meta
}

async function ensureLayout() {
  await Promise.all([
    fsp.mkdir(JOBS_DIR, { recursive: true }),
    fsp.mkdir(LOGS_DIR, { recursive: true }),
  ])
}

function nowIso() {
  return new Date().toISOString()
}

function toStamp(iso) {
  return iso.replace(/[:.]/g, '-').replace('T', '_')
}

async function listTasks(owner = null) {
  const entries = await fsp.readdir(TASKS_DIR)
  const files = entries.filter((name) => /^TASK-\d{4}\.md$/.test(name)).sort()
  const rows = []
  for (const file of files) {
    const abs = path.join(TASKS_DIR, file)
    const content = await fsp.readFile(abs, 'utf8')
    const meta = parseTask(content)
    if (owner && String(meta.owner ?? '').toLowerCase() !== owner) continue
    rows.push({
      id: String(meta.id ?? file.replace(/\.md$/, '')),
      owner: String(meta.owner ?? ''),
      status: String(meta.status ?? ''),
      title: String(meta.title ?? ''),
      updated_at: String(meta.updated_at ?? ''),
    })
  }
  return rows
}

function summarizeStatuses(rows) {
  const counts = { pending: 0, in_progress: 0, in_review: 0, done: 0, blocked: 0, canceled: 0, other: 0 }
  for (const row of rows) {
    if (row.status in counts) counts[row.status] += 1
    else counts.other += 1
  }
  return counts
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

async function loadJob(jobId) {
  const file = path.join(JOBS_DIR, `${jobId}.json`)
  const raw = await fsp.readFile(file, 'utf8')
  return { file, data: JSON.parse(raw) }
}

async function saveJob(file, data) {
  await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function cmdStart(args) {
  await ensureLayout()
  const owner = args.owner ? String(args.owner).toLowerCase() : null
  const status = args.status ? String(args.status) : 'pending'
  const timeoutMs = args.timeout_ms ? String(args.timeout_ms) : null
  const noOutputTimeoutMs = args.no_output_timeout_ms ? String(args.no_output_timeout_ms) : null

  const startedAt = nowIso()
  const jobId = `JOB-${toStamp(startedAt)}`
  const logFile = path.join(LOGS_DIR, `${jobId}.log`)

  const cliArgs = [ORCHESTRATOR, 'dispatch-all']
  if (owner) cliArgs.push('--owner', owner)
  if (status) cliArgs.push('--status', status)
  if (timeoutMs) cliArgs.push('--timeout_ms', timeoutMs)
  if (noOutputTimeoutMs) cliArgs.push('--no_output_timeout_ms', noOutputTimeoutMs)

  const fd = fs.openSync(logFile, 'a')
  const child = spawn(process.execPath, cliArgs, {
    cwd: REPO_ROOT,
    env: process.env,
    detached: true,
    stdio: ['ignore', fd, fd],
  })
  child.unref()
  fs.closeSync(fd)

  const tasks = await listTasks(owner)
  const job = {
    id: jobId,
    pid: child.pid,
    owner: owner ?? 'any',
    status_filter: status,
    timeout_ms: timeoutMs ? Number(timeoutMs) : null,
    no_output_timeout_ms: noOutputTimeoutMs ? Number(noOutputTimeoutMs) : null,
    started_at: startedAt,
    ended_at: null,
    running: true,
    log_file: path.relative(REPO_ROOT, logFile),
    command: `${process.execPath} ${cliArgs.join(' ')}`,
    initial_counts: summarizeStatuses(tasks),
  }
  const file = path.join(JOBS_DIR, `${jobId}.json`)
  await saveJob(file, job)

  console.log(`Started ${jobId}`)
  console.log(`pid=${child.pid}`)
  console.log(`log=${path.relative(REPO_ROOT, logFile)}`)
}

async function cmdList() {
  await ensureLayout()
  const entries = (await fsp.readdir(JOBS_DIR))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse()

  if (entries.length === 0) {
    console.log('No queue jobs found.')
    return
  }

  for (const name of entries) {
    const { data } = await loadJob(name.replace(/\.json$/, ''))
    const running = isPidRunning(Number(data.pid))
    console.log(`${data.id} | running=${running ? 'yes' : 'no'} | owner=${data.owner} | started=${data.started_at}`)
  }
}

async function cmdStatus(args) {
  const jobId = String(args._[1] ?? '').trim()
  if (!jobId) throw new Error('Usage: status JOB-...')

  const { file, data } = await loadJob(jobId)
  const running = isPidRunning(Number(data.pid))
  const tasks = await listTasks(data.owner === 'any' ? null : data.owner)
  const counts = summarizeStatuses(tasks)

  if (!running && data.running) {
    data.running = false
    data.ended_at = nowIso()
    await saveJob(file, data)
  }

  console.log(JSON.stringify({
    id: data.id,
    running,
    pid: data.pid,
    started_at: data.started_at,
    ended_at: running ? null : (data.ended_at ?? null),
    owner: data.owner,
    status_filter: data.status_filter,
    log_file: data.log_file,
    counts,
  }, null, 2))
}

async function cmdWatch(args) {
  const jobId = String(args._[1] ?? '').trim()
  if (!jobId) throw new Error('Usage: watch JOB-...')
  const intervalMs = Number(args.interval_ms ?? 5000)
  let lastLine = ''

  while (true) {
    const { data } = await loadJob(jobId)
    const running = isPidRunning(Number(data.pid))
    const tasks = await listTasks(data.owner === 'any' ? null : data.owner)
    const counts = summarizeStatuses(tasks)
    const line = `${new Date().toISOString()} running=${running ? 'yes' : 'no'} pending=${counts.pending} in_progress=${counts.in_progress} in_review=${counts.in_review} blocked=${counts.blocked} done=${counts.done}`

    if (line !== lastLine) {
      console.log(line)
      lastLine = line
    }
    if (!running) break
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0] ?? 'help'

  switch (cmd) {
    case 'start':
      await cmdStart(args)
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
    case 'help':
    default:
      console.log([
        'Usage:',
        '  node scripts/agents/queue.mjs start [--owner gemini] [--status pending] [--timeout_ms 420000] [--no_output_timeout_ms 180000]',
        '  node scripts/agents/queue.mjs list',
        '  node scripts/agents/queue.mjs status JOB-...',
        '  node scripts/agents/queue.mjs watch JOB-... [--interval_ms 5000]',
      ].join('\n'))
  }
}

main().catch((error) => {
  console.error(`queue error: ${error.message}`)
  process.exit(1)
})
