import { describe, expect, it } from 'vitest'
import { buildCapabilityMatrix, classifyTaskType, computeAgentMetrics, computeQualityScore } from './agent-eval'

const weights = {
  correctness: 0.35,
  regressions: 0.2,
  testAdequacy: 0.2,
  reworkEffort: 0.1,
  throughput: 0.05,
  completionSpeed: 0.05,
  tokenCostEfficiency: 0.05,
}

describe('agent-eval', () => {
  it('classifies task types deterministically', () => {
    expect(classifyTaskType('UI polish task', 'component redesign')).toBe('ui_refactor')
    expect(classifyTaskType('API hardening', 'route and db changes')).toBe('api_backend_logic')
    expect(classifyTaskType('Docs update', 'governance and policy')).toBe('doc_process')
  })

  it('computes quality score reproducibly', () => {
    const metrics = {
      agent: 'a',
      runs: 2,
      successRate: 1,
      regressionRate: 0,
      testAdequacyScore: 1,
      avgReworkPatches: 0,
      throughputPerWeek: 2,
      medianDurationMs: 1000,
      timedOutRate: 0,
    }

    const score1 = computeQualityScore(metrics, weights)
    const score2 = computeQualityScore(metrics, weights)
    expect(score1).toBe(score2)
  })

  it('builds role-fit matrix with recommended agent', () => {
    const runs = [
      {
        taskId: 'TASK-1',
        agent: 'kimi',
        status: 'in_review',
        timedOut: false,
        durationMs: 1000,
        taskType: 'api_backend_logic' as const,
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'TASK-2',
        agent: 'gemini',
        status: 'blocked',
        timedOut: true,
        durationMs: 9000,
        taskType: 'api_backend_logic' as const,
        acceptedWithoutFixes: false,
        reopenedRegression: false,
        reworkPatches: 2,
      },
    ]

    const matrix = buildCapabilityMatrix(runs, weights)
    expect(matrix.api_backend_logic.recommendedAgent).toBe('kimi')
  })

  it('aggregates metrics by agent', () => {
    const metrics = computeAgentMetrics([
      {
        taskId: 'T1',
        agent: 'kimi',
        status: 'in_review',
        timedOut: false,
        durationMs: 1000,
        taskType: 'general',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T2',
        agent: 'kimi',
        status: 'blocked',
        timedOut: true,
        durationMs: 2000,
        taskType: 'general',
        acceptedWithoutFixes: false,
        reopenedRegression: true,
        reworkPatches: 1,
      },
    ])

    expect(metrics).toHaveLength(1)
    expect(metrics[0].timedOutRate).toBe(0.5)
    expect(metrics[0].regressionRate).toBe(0.5)
  })
})
