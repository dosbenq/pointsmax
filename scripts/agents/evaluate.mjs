#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCapabilityMatrix, classifyTaskType, computeAgentMetrics, computeQualityScore } from './agent-eval-core.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUTBOX_DIR = path.join(REPO_ROOT, 'agents', 'outbox')
const TASKS_DIR = path.join(REPO_ROOT, 'agents', 'tasks')
const LOGS_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'logs')
const RUBRIC_PATH = path.join(REPO_ROOT, 'agents', 'config', 'agent-scoring.json')

function stampDate() {
  return new Date().toISOString().slice(0, 10)
}

function parseTaskFrontmatter(content) {
  const id = (content.match(/^id:\s*(TASK-\d{4})$/m) ?? [null, 'UNKNOWN'])[1]
  const title = (content.match(/^title:\s*(.*)$/m) ?? [null, ''])[1]
  const body = content.includes('---\n\n') ? content.split('---\n\n')[1] : content
  return { id, title, body }
}

function parseOutbox(content, file, agent) {
  const get = (key) => (content.match(new RegExp(`^- ${key}:\\s*(.*)$`, 'm')) ?? [null, ''])[1]
  const taskId = (content.match(/^#\s+(TASK-\d{4})/m) ?? [null, 'UNKNOWN'])[1]
  const status = get('status')
  const timedOut = get('timed_out') === 'true'
  const durationMs = Number.parseInt(get('duration_ms') || '0', 10)

  return {
    taskId,
    agent,
    status,
    timedOut,
    durationMs: Number.isFinite(durationMs) ? durationMs : 0,
    acceptedWithoutFixes: status === 'in_review' || status === 'done',
    reopenedRegression: false,
    reworkPatches: status === 'blocked' ? 1 : 0,
    outboxFile: file,
  }
}

function toMarkdown(summaryRows, matrix, generatedAt) {
  const lines = [
    '# Agent Role-Fit Recommendation',
    '',
    `Generated at: ${generatedAt}`,
    '',
    '## Agent Scores',
    '',
    '| agent | runs | quality_score | success_rate | timed_out_rate | median_duration_ms |',
    '| --- | --- | --- | --- | --- | --- |',
  ]

  for (const row of summaryRows) {
    lines.push(`| ${row.agent} | ${row.runs} | ${row.qualityScore} | ${Math.round(row.successRate * 100)}% | ${Math.round(row.timedOutRate * 100)}% | ${row.medianDurationMs} |`)
  }

  lines.push('', '## Capability Matrix', '', '| task_type | recommended_agent | notes |', '| --- | --- | --- |')
  for (const [taskType, value] of Object.entries(matrix)) {
    const scoreText = value.scores.map((row) => `${row.agent}:${row.score}`).join(', ') || 'no-data'
    lines.push(`| ${taskType} | ${value.recommendedAgent ?? 'none'} | ${scoreText} |`)
  }

  return lines.join('\n')
}

async function main() {
  const generatedAt = new Date().toISOString()
  const rubricRaw = await fs.readFile(RUBRIC_PATH, 'utf8')
  const weights = JSON.parse(rubricRaw).weights

  const taskMap = new Map()
  const taskFiles = (await fs.readdir(TASKS_DIR)).filter((name) => /^TASK-\d{4}\.md$/.test(name))
  for (const file of taskFiles) {
    const content = await fs.readFile(path.join(TASKS_DIR, file), 'utf8')
    const parsed = parseTaskFrontmatter(content)
    taskMap.set(parsed.id, parsed)
  }

  const runs = []
  const agents = await fs.readdir(OUTBOX_DIR).catch(() => [])
  for (const agent of agents) {
    const dir = path.join(OUTBOX_DIR, agent)
    const stat = await fs.stat(dir).catch(() => null)
    if (!stat?.isDirectory()) continue

    const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.md')).sort()
    for (const file of files) {
      const content = await fs.readFile(path.join(dir, file), 'utf8')
      const run = parseOutbox(content, `agents/outbox/${agent}/${file}`, agent)
      const task = taskMap.get(run.taskId)
      const taskType = classifyTaskType(task?.title ?? run.taskId, task?.body ?? '')
      runs.push({ ...run, taskType })
    }
  }

  const metrics = computeAgentMetrics(runs)
  const summaryRows = metrics
    .map((row) => ({
      ...row,
      qualityScore: computeQualityScore(row, weights),
    }))
    .sort((a, b) => b.qualityScore - a.qualityScore)

  const matrix = buildCapabilityMatrix(runs, weights)

  const artifact = {
    generated_at: generatedAt,
    weights,
    runs,
    summary: summaryRows,
    capability_matrix: matrix,
  }

  await fs.mkdir(LOGS_DIR, { recursive: true })
  const jsonPath = path.join(LOGS_DIR, `agent-eval-${stampDate()}.json`)
  const markdownPath = path.join(LOGS_DIR, 'agent-role-fit-latest.md')
  await fs.writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  await fs.writeFile(markdownPath, `${toMarkdown(summaryRows, matrix, generatedAt)}\n`, 'utf8')

  console.log(`wrote ${path.relative(REPO_ROOT, jsonPath)}`)
  console.log(`wrote ${path.relative(REPO_ROOT, markdownPath)}`)
}

main().catch((error) => {
  console.error(`agent evaluation failed: ${error.message}`)
  process.exit(1)
})
