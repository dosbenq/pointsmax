#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const AGENTS_ROOT = path.join(REPO_ROOT, 'agents')
const CONFIG_PATH = path.join(AGENTS_ROOT, 'config', 'agents.json')
const RUNNER_DIR = path.join(AGENTS_ROOT, 'runtime', 'runner')
const SUPERVISOR_DIR = path.join(AGENTS_ROOT, 'runtime', 'supervisor')
const SUPERVISOR_SCRIPT = path.join(REPO_ROOT, 'scripts', 'agents', 'supervisor.mjs')

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

function toStamp(iso) {
  return iso.replace(/[:.]/g, '-').replace('T', '_')
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
  await fs.mkdir(RUNNER_DIR, { recursive: true })
}

async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8')
  return JSON.parse(raw)
}

async function listSupervisorFiles() {
  const entries = await fs.readdir(SUPERVISOR_DIR).catch(() => [])
  return entries
    .filter((name) => name.endsWith('.json') && !name.endsWith('.status.json') && !name.endsWith('.retries.json'))
    .sort()
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function writeJson(file, payload) {
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function findRunningSupervisor(owner) {
  const files = await listSupervisorFiles()
  for (const name of files) {
    const file = path.join(SUPERVISOR_DIR, name)
    const data = await readJson(file).catch(() => null)
    if (!data) continue
    if (String(data.owner ?? '') !== owner) continue
    if (!isPidRunning(Number(data.pid))) continue
    return data
  }
  return null
}

function parseSupervisorStart(stdout) {
  const lines = String(stdout).split('\n')
  const jobId = lines.find((line) => line.startsWith('Started '))?.replace('Started ', '').trim()
  const pidLine = lines.find((line) => line.startsWith('pid='))
  const logLine = lines.find((line) => line.startsWith('log='))
  if (!jobId) {
    throw new Error(`Could not parse supervisor start output: ${stdout}`)
  }
  return {
    job_id: jobId,
    pid: pidLine ? Number(pidLine.replace('pid=', '').trim()) : null,
    log_file: logLine ? logLine.replace('log=', '').trim() : null,
  }
}

async function startSupervisor(owner, options) {
  const args = [
    SUPERVISOR_SCRIPT,
    'start',
    '--owner',
    owner,
    '--status',
    String(options.status ?? 'pending'),
    '--interval_ms',
    String(options.interval_ms ?? 15000),
    '--timeout_ms',
    String(options.timeout_ms ?? 1200000),
    '--no_output_timeout_ms',
    String(options.no_output_timeout_ms ?? 900000),
    '--max_blocked_retries',
    String(options.max_blocked_retries ?? 2),
  ]
  if (options.allow_parallel) {
    args.push('--allow_parallel', 'true')
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      if ((code ?? 1) !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `supervisor start failed for ${owner}`))
        return
      }
      try {
        resolve(parseSupervisorStart(stdout))
      } catch (error) {
        reject(error)
      }
    })
    child.on('error', reject)
  })
}

async function stopSupervisor(jobId) {
  const args = [SUPERVISOR_SCRIPT, 'stop', jobId]
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      if ((code ?? 1) !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `supervisor stop failed for ${jobId}`))
        return
      }
      resolve(stdout.trim())
    })
    child.on('error', reject)
  })
}

async function readSupervisorStatus(jobId) {
  const supervisorFile = path.join(SUPERVISOR_DIR, `${jobId}.json`)
  const data = await readJson(supervisorFile).catch(() => null)
  if (!data) return null
  const heartbeatFile = path.join(SUPERVISOR_DIR, `${jobId}.status.json`)
  const heartbeat = await readJson(heartbeatFile).catch(() => null)
  return {
    id: data.id,
    owner: data.owner,
    pid: data.pid,
    running: isPidRunning(Number(data.pid)),
    started_at: data.started_at,
    ended_at: data.ended_at ?? null,
    log_file: data.log_file,
    heartbeat,
  }
}

async function readRunnerManifest(id) {
  const file = path.join(RUNNER_DIR, `${id}.json`)
  return { file, data: await readJson(file) }
}

function parseOwners(raw, config) {
  if (raw) {
    return String(raw)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  }

  return Object.entries(config.agents ?? {})
    .filter(([owner, agent]) => owner !== 'codex' && agent?.enabled)
    .map(([owner]) => owner)
}

async function cmdStart(args) {
  await ensureLayout()
  const config = await loadConfig()
  const owners = parseOwners(args.owners, config)
  if (owners.length === 0) {
    throw new Error('No enabled agent owners found for runner')
  }

  const runnerId = `RUN-${toStamp(nowIso())}`
  const file = path.join(RUNNER_DIR, `${runnerId}.json`)
  const options = {
    status: args.status ?? 'pending',
    interval_ms: Number(args.interval_ms ?? 15000),
    timeout_ms: Number(args.timeout_ms ?? 1200000),
    no_output_timeout_ms: Number(args.no_output_timeout_ms ?? 900000),
    max_blocked_retries: Number(args.max_blocked_retries ?? 2),
  }

  if (args['dry-run']) {
    console.log(
      JSON.stringify(
        {
          id: runnerId,
          owners,
          options,
          dry_run: true,
        },
        null,
        2
      )
    )
    return
  }

  const supervisors = []
  for (const owner of owners) {
    const existing = await findRunningSupervisor(owner)
    if (existing) {
      supervisors.push({
        owner,
        job_id: existing.id,
        pid: existing.pid,
        log_file: existing.log_file,
        attached: true,
      })
      continue
    }

    const started = await startSupervisor(owner, options)
    supervisors.push({
      owner,
      job_id: started.job_id,
      pid: started.pid,
      log_file: started.log_file,
      attached: false,
    })
  }

  const manifest = {
    id: runnerId,
    owners,
    options,
    started_at: nowIso(),
    ended_at: null,
    supervisors,
  }
  await writeJson(file, manifest)

  console.log(`Started ${runnerId}`)
  for (const item of supervisors) {
    console.log(`${item.owner}: ${item.job_id} pid=${item.pid ?? 'n/a'} attached=${item.attached ? 'yes' : 'no'}`)
  }
}

async function cmdList() {
  await ensureLayout()
  const entries = (await fs.readdir(RUNNER_DIR)).filter((name) => name.endsWith('.json')).sort().reverse()
  if (entries.length === 0) {
    console.log('No runner jobs found.')
    return
  }

  for (const name of entries) {
    const data = await readJson(path.join(RUNNER_DIR, name))
    let running = false
    for (const sup of data.supervisors ?? []) {
      if (isPidRunning(Number(sup.pid))) {
        running = true
        break
      }
    }
    console.log(`${data.id} | running=${running ? 'yes' : 'no'} | owners=${(data.owners ?? []).join(',')} | started=${data.started_at}`)
  }
}

async function buildRunnerStatus(id) {
  const { file, data } = await readRunnerManifest(id)
  const supervisors = []
  let anyRunning = false
  for (const sup of data.supervisors ?? []) {
    const status = await readSupervisorStatus(String(sup.job_id))
    if (status?.running) anyRunning = true
    supervisors.push({
      owner: sup.owner,
      job_id: sup.job_id,
      attached: Boolean(sup.attached),
      status,
    })
  }

  if (!anyRunning && !data.ended_at) {
    data.ended_at = nowIso()
    await writeJson(file, data)
  }

  return {
    id: data.id,
    owners: data.owners,
    options: data.options,
    started_at: data.started_at,
    ended_at: data.ended_at,
    running: anyRunning,
    supervisors,
  }
}

async function cmdStatus(args) {
  const id = String(args._[1] ?? '').trim()
  if (!id) throw new Error('Usage: status RUN-...')
  console.log(JSON.stringify(await buildRunnerStatus(id), null, 2))
}

async function cmdWatch(args) {
  const id = String(args._[1] ?? '').trim()
  if (!id) throw new Error('Usage: watch RUN-...')
  const intervalMs = Number(args.interval_ms ?? 5000)
  let lastLine = ''
  while (true) {
    const status = await buildRunnerStatus(id)
    const ownerBits = status.supervisors.map((item) => {
      const counts = item.status?.heartbeat?.counts_after ?? {}
      const phase = item.status?.heartbeat?.phase ?? 'unknown'
      const state = item.status?.running ? 'up' : 'down'
      return `${item.owner}:${state}:${phase}:p${counts.pending ?? '?'}:r${counts.in_review ?? '?'}:b${counts.blocked ?? '?'}`
    })
    const line = `${new Date().toISOString()} running=${status.running ? 'yes' : 'no'} ${ownerBits.join(' ')}`
    if (line !== lastLine) {
      console.log(line)
      lastLine = line
    }
    if (!status.running) break
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

async function cmdStop(args) {
  const id = String(args._[1] ?? '').trim()
  if (!id) throw new Error('Usage: stop RUN-...')
  const { file, data } = await readRunnerManifest(id)
  const results = []
  for (const sup of data.supervisors ?? []) {
    const running = isPidRunning(Number(sup.pid))
    if (!running) {
      results.push({ owner: sup.owner, job_id: sup.job_id, stopped: false, reason: 'already_stopped' })
      continue
    }
    await stopSupervisor(String(sup.job_id))
    results.push({ owner: sup.owner, job_id: sup.job_id, stopped: true })
  }
  data.ended_at = nowIso()
  await writeJson(file, data)
  console.log(JSON.stringify({ id, stopped_at: data.ended_at, results }, null, 2))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0] ?? 'help'

  switch (cmd) {
    case 'start':
      await cmdStart(args)
      return
    case 'list':
      await cmdList()
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
        '  node scripts/agents/runner.mjs start [--owners kimi,gemini,claude] [--status pending] [--interval_ms 15000] [--timeout_ms 1200000] [--no_output_timeout_ms 900000] [--max_blocked_retries 2]',
        '  node scripts/agents/runner.mjs list',
        '  node scripts/agents/runner.mjs status RUN-...',
        '  node scripts/agents/runner.mjs watch RUN-... [--interval_ms 5000]',
        '  node scripts/agents/runner.mjs stop RUN-...',
        '',
        'Defaults:',
        '  - owners: all enabled agents except codex',
        '  - runner attaches to existing per-owner supervisors if they are already running',
      ].join('\n'))
  }
}

main().catch((error) => {
  console.error(`runner error: ${error.message}`)
  process.exit(1)
})
