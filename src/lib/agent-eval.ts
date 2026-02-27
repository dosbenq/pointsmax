export type AgentTaskType =
  | 'ui_refactor'
  | 'api_backend_logic'
  | 'test_authoring'
  | 'migration_security'
  | 'doc_process'
  | 'general'

export interface AgentRunSummary {
  taskId: string
  agent: string
  status: string
  timedOut: boolean
  durationMs: number
  taskType: AgentTaskType
  acceptedWithoutFixes?: boolean
  reopenedRegression?: boolean
  reworkPatches?: number
}

export interface AgentScoringWeights {
  correctness: number
  regressions: number
  testAdequacy: number
  reworkEffort: number
  throughput: number
  completionSpeed: number
  tokenCostEfficiency: number
}

export interface AgentMetrics {
  agent: string
  runs: number
  successRate: number
  regressionRate: number
  testAdequacyScore: number
  avgReworkPatches: number
  throughputPerWeek: number
  medianDurationMs: number
  timedOutRate: number
}

export function classifyTaskType(title: string, body: string): AgentTaskType {
  const haystack = `${title} ${body}`.toLowerCase()
  if (/\b(ui|frontend|component|layout|design|ux)\b/.test(haystack)) return 'ui_refactor'
  if (/\b(api|backend|route|db|query|service|cache)\b/.test(haystack)) return 'api_backend_logic'
  if (/\b(test|coverage|fixture|mock)\b/.test(haystack)) return 'test_authoring'
  if (/\b(migration|security|rls|auth|rate limit|cors)\b/.test(haystack)) return 'migration_security'
  if (/\b(doc|readme|governance|policy|checklist|process)\b/.test(haystack)) return 'doc_process'
  return 'general'
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export function computeAgentMetrics(runs: AgentRunSummary[]): AgentMetrics[] {
  const byAgent = new Map<string, AgentRunSummary[]>()
  for (const run of runs) {
    if (!byAgent.has(run.agent)) byAgent.set(run.agent, [])
    byAgent.get(run.agent)?.push(run)
  }

  return [...byAgent.entries()].map(([agent, agentRuns]) => {
    const total = agentRuns.length
    const successes = agentRuns.filter((run) => run.status === 'in_review' || run.status === 'done').length
    const regressions = agentRuns.filter((run) => run.reopenedRegression).length
    const accepted = agentRuns.filter((run) => run.acceptedWithoutFixes).length
    const reworkTotal = agentRuns.reduce((acc, run) => acc + (run.reworkPatches ?? 0), 0)
    const timedOut = agentRuns.filter((run) => run.timedOut).length
    const medianDurationMs = median(agentRuns.map((run) => run.durationMs))

    return {
      agent,
      runs: total,
      successRate: total === 0 ? 0 : successes / total,
      regressionRate: total === 0 ? 0 : regressions / total,
      testAdequacyScore: total === 0 ? 0 : accepted / total,
      avgReworkPatches: total === 0 ? 0 : reworkTotal / total,
      throughputPerWeek: total,
      medianDurationMs,
      timedOutRate: total === 0 ? 0 : timedOut / total,
    }
  })
}

export function computeQualityScore(metrics: AgentMetrics, weights: AgentScoringWeights): number {
  const speedScore = metrics.medianDurationMs === 0 ? 0 : 1 / metrics.medianDurationMs
  const reworkScore = 1 / (1 + metrics.avgReworkPatches)
  const timeoutPenalty = 1 - metrics.timedOutRate

  const score =
    (metrics.successRate * weights.correctness) +
    ((1 - metrics.regressionRate) * weights.regressions) +
    (metrics.testAdequacyScore * weights.testAdequacy) +
    (reworkScore * weights.reworkEffort) +
    (metrics.throughputPerWeek * weights.throughput) +
    (speedScore * weights.completionSpeed * 1000) +
    (timeoutPenalty * weights.tokenCostEfficiency)

  return Math.round(score * 1000) / 1000
}

export function buildCapabilityMatrix(
  runs: AgentRunSummary[],
  weights: AgentScoringWeights,
): Record<AgentTaskType, { recommendedAgent: string | null; scores: Array<{ agent: string; score: number }> }> {
  const taskTypes: AgentTaskType[] = ['ui_refactor', 'api_backend_logic', 'test_authoring', 'migration_security', 'doc_process', 'general']
  const result = {} as Record<AgentTaskType, { recommendedAgent: string | null; scores: Array<{ agent: string; score: number }> }>

  for (const taskType of taskTypes) {
    const scopedRuns = runs.filter((run) => run.taskType === taskType)
    const metrics = computeAgentMetrics(scopedRuns)
    const scored = metrics
      .map((row) => ({ agent: row.agent, score: computeQualityScore(row, weights) }))
      .sort((a, b) => b.score - a.score)

    result[taskType] = {
      recommendedAgent: scored[0]?.agent ?? null,
      scores: scored,
    }
  }

  return result
}

export interface AgentSummaryRow {
  agent: string
  runs: number
  qualityScore: number
  successRate: number
  timedOutRate: number
  medianDurationMs: number
}

export function generateRoleFitMarkdown(
  summaryRows: AgentSummaryRow[],
  matrix: Record<AgentTaskType, { recommendedAgent: string | null; scores: Array<{ agent: string; score: number }> }>,
  generatedAt: string,
): string {
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

const REQUIRED_WEIGHT_KEYS: (keyof AgentScoringWeights)[] = [
  'correctness',
  'regressions',
  'testAdequacy',
  'reworkEffort',
  'throughput',
  'completionSpeed',
  'tokenCostEfficiency',
]

export function validateScoringRubric(rubric: unknown): rubric is { weights: AgentScoringWeights } {
  if (!rubric || typeof rubric !== 'object') {
    throw new Error('rubric must be an object')
  }
  const r = rubric as Record<string, unknown>
  if (!r.weights || typeof r.weights !== 'object') {
    throw new Error('rubric.weights must be an object')
  }

  const weights = r.weights as Record<string, unknown>
  const missing = REQUIRED_WEIGHT_KEYS.filter((key) => !(key in weights))
  if (missing.length > 0) {
    throw new Error(`rubric missing required weights: ${missing.join(', ')}`)
  }

  for (const key of REQUIRED_WEIGHT_KEYS) {
    const value = weights[key]
    if (typeof value !== 'number' || value < 0 || value > 1) {
      throw new Error(`rubric.weights.${key} must be a number between 0 and 1, got ${value}`)
    }
  }

  const total = REQUIRED_WEIGHT_KEYS.reduce((sum, key) => sum + (weights[key] as number), 0)
  if (Math.abs(total - 1) > 0.001) {
    throw new Error(`rubric weights must sum to 1, got ${total}`)
  }

  return true
}
