export function classifyTaskType(title, body) {
  const haystack = `${title} ${body}`.toLowerCase()
  if (/\b(ui|frontend|component|layout|design|ux)\b/.test(haystack)) return 'ui_refactor'
  if (/\b(api|backend|route|db|query|service|cache)\b/.test(haystack)) return 'api_backend_logic'
  if (/\b(test|coverage|fixture|mock)\b/.test(haystack)) return 'test_authoring'
  if (/\b(migration|security|rls|auth|rate limit|cors)\b/.test(haystack)) return 'migration_security'
  if (/\b(doc|readme|governance|policy|checklist|process)\b/.test(haystack)) return 'doc_process'
  return 'general'
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export function computeAgentMetrics(runs) {
  const byAgent = new Map()
  for (const run of runs) {
    if (!byAgent.has(run.agent)) byAgent.set(run.agent, [])
    byAgent.get(run.agent).push(run)
  }

  return [...byAgent.entries()].map(([agent, agentRuns]) => {
    const total = agentRuns.length
    const successes = agentRuns.filter((run) => run.status === 'in_review' || run.status === 'done').length
    const regressions = agentRuns.filter((run) => run.reopenedRegression).length
    const accepted = agentRuns.filter((run) => run.acceptedWithoutFixes).length
    const reworkTotal = agentRuns.reduce((acc, run) => acc + (run.reworkPatches ?? 0), 0)
    const timedOut = agentRuns.filter((run) => run.timedOut).length

    return {
      agent,
      runs: total,
      successRate: total === 0 ? 0 : successes / total,
      regressionRate: total === 0 ? 0 : regressions / total,
      testAdequacyScore: total === 0 ? 0 : accepted / total,
      avgReworkPatches: total === 0 ? 0 : reworkTotal / total,
      throughputPerWeek: total,
      medianDurationMs: median(agentRuns.map((run) => run.durationMs)),
      timedOutRate: total === 0 ? 0 : timedOut / total,
    }
  })
}

export function computeQualityScore(metrics, weights) {
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

export function buildCapabilityMatrix(runs, weights) {
  const taskTypes = ['ui_refactor', 'api_backend_logic', 'test_authoring', 'migration_security', 'doc_process', 'general']
  const result = {}

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
