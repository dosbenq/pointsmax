#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUTBOX_DIR = path.join(REPO_ROOT, 'agents', 'outbox')
const LOGS_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'logs')

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

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function percentile(values, p) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

function extractBlock(content, title) {
  const marker = `## ${title}`
  const start = content.indexOf(marker)
  if (start === -1) return ''
  const fenceStart = content.indexOf('```text', start)
  if (fenceStart === -1) return ''
  const bodyStart = content.indexOf('\n', fenceStart)
  if (bodyStart === -1) return ''
  const fenceEnd = content.indexOf('\n```', bodyStart)
  if (fenceEnd === -1) return ''
  return content.slice(bodyStart + 1, fenceEnd)
}

function parseOutbox(content, fallbackTaskId, agent) {
  const line = (key) => {
    const match = content.match(new RegExp(`^- ${key}:\\s*(.*)$`, 'm'))
    return match ? match[1].trim() : ''
  }

  const status = line('status')
  const exitCode = toNumber(line('exit_code'), 1)
  const timedOut = line('timed_out') === 'true'
  const timeoutType = line('timeout_type') || 'none'
  const durationMs = toNumber(line('duration_ms'))
  const ranAt = line('ran_at')
  const command = line('command')
  const stdout = extractBlock(content, 'stdout')
  const stderr = extractBlock(content, 'stderr')
  const headerMatch = content.match(/^#\s+(TASK-\d{4})/m)

  return {
    taskId: headerMatch?.[1] ?? fallbackTaskId,
    agent,
    status,
    exitCode,
    timedOut,
    timeoutType,
    durationMs,
    ranAt,
    command,
    stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
    stderrBytes: Buffer.byteLength(stderr, 'utf8'),
  }
}

function summarizeAgent(agent, runs) {
  const total = runs.length
  const success = runs.filter((r) => r.status === 'in_review' || r.status === 'done').length
  const blocked = runs.filter((r) => r.status === 'blocked').length
  const timeouts = runs.filter((r) => r.timedOut).length
  const outputful = runs.filter((r) => r.stdoutBytes > 0).length
  const durations = runs.map((r) => r.durationMs).filter((v) => Number.isFinite(v) && v >= 0)

  const successRate = total === 0 ? 0 : success / total
  const timeoutRate = total === 0 ? 0 : timeouts / total
  const outputRate = total === 0 ? 0 : outputful / total
  const avgDurationMs = durations.length === 0 ? 0 : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  const p95DurationMs = percentile(durations, 95)

  // Heuristic score for cross-agent ranking.
  const score = Math.round((successRate * 100) - (timeoutRate * 60) + (outputRate * 20))

  return {
    agent,
    total,
    success,
    blocked,
    timeouts,
    outputful,
    successRate,
    timeoutRate,
    outputRate,
    avgDurationMs,
    p95DurationMs,
    score,
  }
}

function renderTable(rows, columns) {
  const header = `| ${columns.join(' | ')} |`
  const sep = `| ${columns.map(() => '---').join(' | ')} |`
  const lines = rows.map((row) => `| ${columns.map((c) => String(row[c] ?? '')).join(' | ')} |`)
  return [header, sep, ...lines].join('\n')
}

async function collectRuns(filterAgent = null) {
  const runs = []
  let agentDirs = []
  try {
    agentDirs = await fs.readdir(OUTBOX_DIR)
  } catch {
    return runs
  }

  for (const agent of agentDirs) {
    if (filterAgent && agent !== filterAgent) continue
    const dir = path.join(OUTBOX_DIR, agent)
    const stat = await fs.stat(dir).catch(() => null)
    if (!stat?.isDirectory()) continue

    const files = (await fs.readdir(dir))
      .filter((name) => name.endsWith('.md') && name.startsWith('TASK-'))
      .sort()

    for (const name of files) {
      const abs = path.join(dir, name)
      const content = await fs.readFile(abs, 'utf8')
      const taskId = (name.match(/^(TASK-\d{4})/) ?? [null, 'UNKNOWN'])[1]
      runs.push({
        ...parseOutbox(content, taskId, agent),
        outboxFile: path.relative(REPO_ROOT, abs),
      })
    }
  }
  return runs
}

function buildReport(runs) {
  const byAgent = new Map()
  for (const run of runs) {
    if (!byAgent.has(run.agent)) byAgent.set(run.agent, [])
    byAgent.get(run.agent).push(run)
  }

  const summaries = [...byAgent.entries()].map(([agent, agentRuns]) => summarizeAgent(agent, agentRuns))
  summaries.sort((a, b) => b.score - a.score)

  const latestTaskRun = new Map()
  for (const run of runs) {
    const existing = latestTaskRun.get(run.taskId)
    if (!existing || String(run.ranAt) > String(existing.ranAt)) {
      latestTaskRun.set(run.taskId, run)
    }
  }
  const taskRows = [...latestTaskRun.values()].sort((a, b) => a.taskId.localeCompare(b.taskId))

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      runs: runs.length,
      agents: summaries.length,
    },
    summaries,
    taskRows,
  }
}

function reportToMarkdown(report) {
  const summaryRows = report.summaries.map((s) => ({
    agent: s.agent,
    runs: s.total,
    success_rate: `${Math.round(s.successRate * 100)}%`,
    timeout_rate: `${Math.round(s.timeoutRate * 100)}%`,
    output_rate: `${Math.round(s.outputRate * 100)}%`,
    avg_duration_ms: s.avgDurationMs,
    p95_duration_ms: s.p95DurationMs,
    score: s.score,
  }))

  const taskRows = report.taskRows.map((r) => ({
    task: r.taskId,
    agent: r.agent,
    status: r.status,
    timed_out: r.timedOut ? 'yes' : 'no',
    timeout_type: r.timeoutType,
    duration_ms: r.durationMs,
    outbox: r.outboxFile,
  }))

  return [
    '# Agent Performance Report',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    `Total runs: ${report.totals.runs}`,
    `Agents measured: ${report.totals.agents}`,
    '',
    '## Agent summary',
    '',
    renderTable(summaryRows, [
      'agent',
      'runs',
      'success_rate',
      'timeout_rate',
      'output_rate',
      'avg_duration_ms',
      'p95_duration_ms',
      'score',
    ]),
    '',
    '## Latest run per task',
    '',
    renderTable(taskRows, ['task', 'agent', 'status', 'timed_out', 'timeout_type', 'duration_ms', 'outbox']),
    '',
  ].join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const filterAgent = args.agent ? String(args.agent).toLowerCase() : null
  const runs = await collectRuns(filterAgent)
  const report = buildReport(runs)

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const markdown = reportToMarkdown(report)
  console.log(markdown)

  if (args.write) {
    await fs.mkdir(LOGS_DIR, { recursive: true })
    const file = path.join(LOGS_DIR, 'agent-performance-latest.md')
    await fs.writeFile(file, markdown, 'utf8')
    console.error(`wrote ${path.relative(REPO_ROOT, file)}`)
  }
}

main().catch((error) => {
  console.error(`agents report error: ${error.message}`)
  process.exit(1)
})
