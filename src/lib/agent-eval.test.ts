import { describe, expect, it } from 'vitest'
import {
  buildCapabilityMatrix,
  classifyTaskType,
  computeAgentMetrics,
  computeQualityScore,
  validateScoringRubric,
  generateRoleFitMarkdown,
  type AgentRunSummary,
  type AgentScoringWeights,
} from './agent-eval'

const weights: AgentScoringWeights = {
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

  describe('scoring rubric validation', () => {
    it('validates correct rubric format', () => {
      const validRubric = {
        weights: {
          correctness: 0.35,
          regressions: 0.2,
          testAdequacy: 0.2,
          reworkEffort: 0.1,
          throughput: 0.05,
          completionSpeed: 0.05,
          tokenCostEfficiency: 0.05,
        },
      }
      expect(validateScoringRubric(validRubric)).toBe(true)
    })

    it('fails on missing weights', () => {
      const invalidRubric = {
        weights: {
          correctness: 0.35,
          regressions: 0.2,
        },
      }
      expect(() => validateScoringRubric(invalidRubric)).toThrow('rubric missing required weights')
    })

    it('fails on invalid weight type', () => {
      const invalidRubric = {
        weights: {
          correctness: 'invalid',
          regressions: 0.2,
          testAdequacy: 0.2,
          reworkEffort: 0.1,
          throughput: 0.05,
          completionSpeed: 0.05,
          tokenCostEfficiency: 0.05,
        },
      }
      expect(() => validateScoringRubric(invalidRubric)).toThrow('must be a number')
    })

    it('fails on weight out of range', () => {
      const invalidRubric = {
        weights: {
          correctness: 1.5,
          regressions: 0.2,
          testAdequacy: 0.2,
          reworkEffort: 0.1,
          throughput: 0.05,
          completionSpeed: 0.05,
          tokenCostEfficiency: 0.05,
        },
      }
      expect(() => validateScoringRubric(invalidRubric)).toThrow('between 0 and 1')
    })

    it('fails on weights not summing to 1', () => {
      const invalidRubric = {
        weights: {
          correctness: 0.5,
          regressions: 0.5,
          testAdequacy: 0.5,
          reworkEffort: 0.5,
          throughput: 0.05,
          completionSpeed: 0.05,
          tokenCostEfficiency: 0.05,
        },
      }
      expect(() => validateScoringRubric(invalidRubric)).toThrow('must sum to 1')
    })

    it('fails on non-object rubric', () => {
      expect(() => validateScoringRubric(null)).toThrow('rubric must be an object')
      expect(() => validateScoringRubric('string')).toThrow('rubric must be an object')
    })

    it('fails on rubric without weights object', () => {
      expect(() => validateScoringRubric({})).toThrow('rubric.weights must be an object')
    })
  })

  describe('task type classification', () => {
    it('classifies ui_refactor tasks', () => {
      expect(classifyTaskType('UI component update', 'Redesign button layout')).toBe('ui_refactor')
      expect(classifyTaskType('Frontend polish', 'Component styling')).toBe('ui_refactor')
      expect(classifyTaskType('UX improvement', 'Design system update')).toBe('ui_refactor')
    })

    it('classifies api_backend_logic tasks', () => {
      expect(classifyTaskType('API endpoint', 'New route handler')).toBe('api_backend_logic')
      expect(classifyTaskType('Backend service', 'Database query optimization')).toBe('api_backend_logic')
      expect(classifyTaskType('Cache layer', 'Redis service implementation')).toBe('api_backend_logic')
    })

    it('classifies test_authoring tasks', () => {
      expect(classifyTaskType('Unit tests', 'Coverage for auth module')).toBe('test_authoring')
      expect(classifyTaskType('Test fixtures', 'Mock data setup')).toBe('test_authoring')
      expect(classifyTaskType('E2E tests', 'Integration test suite')).toBe('test_authoring')
    })

    it('classifies migration_security tasks', () => {
      expect(classifyTaskType('Schema migration', 'Changes for users table')).toBe('migration_security')
      expect(classifyTaskType('Security fix', 'RLS policy update')).toBe('migration_security')
      expect(classifyTaskType('Auth hardening', 'Rate limiting and CORS')).toBe('migration_security')
    })

    it('classifies doc_process tasks', () => {
      expect(classifyTaskType('README update', 'Documentation refresh')).toBe('doc_process')
      expect(classifyTaskType('Governance doc', 'Policy checklist')).toBe('doc_process')
      expect(classifyTaskType('Process guide', 'Workflow docs')).toBe('doc_process')
    })

    it('defaults to general for unknown tasks', () => {
      expect(classifyTaskType('Random task', 'Unknown description')).toBe('general')
    })
  })

  describe('capability matrix generation', () => {
    const fixtureRuns: AgentRunSummary[] = [
      // UI refactor tasks - kimi performs better
      {
        taskId: 'T-UI-1',
        agent: 'kimi',
        status: 'done',
        timedOut: false,
        durationMs: 1000,
        taskType: 'ui_refactor',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-UI-2',
        agent: 'kimi',
        status: 'in_review',
        timedOut: false,
        durationMs: 1200,
        taskType: 'ui_refactor',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-UI-3',
        agent: 'gemini',
        status: 'blocked',
        timedOut: true,
        durationMs: 10000,
        taskType: 'ui_refactor',
        acceptedWithoutFixes: false,
        reopenedRegression: false,
        reworkPatches: 2,
      },
      // API backend tasks - gemini performs better
      {
        taskId: 'T-API-1',
        agent: 'gemini',
        status: 'done',
        timedOut: false,
        durationMs: 1500,
        taskType: 'api_backend_logic',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-API-2',
        agent: 'gemini',
        status: 'done',
        timedOut: false,
        durationMs: 1600,
        taskType: 'api_backend_logic',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-API-3',
        agent: 'kimi',
        status: 'blocked',
        timedOut: false,
        durationMs: 5000,
        taskType: 'api_backend_logic',
        acceptedWithoutFixes: false,
        reopenedRegression: true,
        reworkPatches: 3,
      },
      // Test authoring tasks - codex is best
      {
        taskId: 'T-TEST-1',
        agent: 'codex',
        status: 'done',
        timedOut: false,
        durationMs: 800,
        taskType: 'test_authoring',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-TEST-2',
        agent: 'codex',
        status: 'in_review',
        timedOut: false,
        durationMs: 900,
        taskType: 'test_authoring',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-TEST-3',
        agent: 'kimi',
        status: 'done',
        timedOut: false,
        durationMs: 2000,
        taskType: 'test_authoring',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 1,
      },
      // Migration security tasks - claude is best
      {
        taskId: 'T-MIG-1',
        agent: 'claude',
        status: 'done',
        timedOut: false,
        durationMs: 2000,
        taskType: 'migration_security',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-MIG-2',
        agent: 'claude',
        status: 'done',
        timedOut: false,
        durationMs: 2200,
        taskType: 'migration_security',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-MIG-3',
        agent: 'kimi',
        status: 'blocked',
        timedOut: true,
        durationMs: 30000,
        taskType: 'migration_security',
        acceptedWithoutFixes: false,
        reopenedRegression: false,
        reworkPatches: 2,
      },
      // Doc process tasks - all agents perform similarly
      {
        taskId: 'T-DOC-1',
        agent: 'kimi',
        status: 'done',
        timedOut: false,
        durationMs: 500,
        taskType: 'doc_process',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
      {
        taskId: 'T-DOC-2',
        agent: 'gemini',
        status: 'done',
        timedOut: false,
        durationMs: 600,
        taskType: 'doc_process',
        acceptedWithoutFixes: true,
        reopenedRegression: false,
        reworkPatches: 0,
      },
    ]

    it('recommends correct agent for each task type from fixture data', () => {
      const matrix = buildCapabilityMatrix(fixtureRuns, weights)

      expect(matrix.ui_refactor.recommendedAgent).toBe('kimi')
      expect(matrix.api_backend_logic.recommendedAgent).toBe('gemini')
      expect(matrix.test_authoring.recommendedAgent).toBe('codex')
      expect(matrix.migration_security.recommendedAgent).toBe('claude')
      expect(matrix.doc_process.recommendedAgent).toBe('kimi') // kimi has slightly better score
    })

    it('provides scores for all task types in matrix', () => {
      const matrix = buildCapabilityMatrix(fixtureRuns, weights)

      expect(matrix.ui_refactor.scores).toHaveLength(2)
      expect(matrix.api_backend_logic.scores).toHaveLength(2)
      expect(matrix.test_authoring.scores).toHaveLength(2)
      expect(matrix.migration_security.scores).toHaveLength(2)
      expect(matrix.doc_process.scores).toHaveLength(2)
      expect(matrix.general.scores).toHaveLength(0) // no general tasks in fixture
    })

    it('sorts scores in descending order', () => {
      const matrix = buildCapabilityMatrix(fixtureRuns, weights)

      expect(matrix.ui_refactor.scores[0].score).toBeGreaterThan(matrix.ui_refactor.scores[1].score)
      expect(matrix.api_backend_logic.scores[0].score).toBeGreaterThan(matrix.api_backend_logic.scores[1].score)
    })

    it('returns null recommendation when no data exists', () => {
      const matrix = buildCapabilityMatrix([], weights)

      expect(matrix.ui_refactor.recommendedAgent).toBeNull()
      expect(matrix.api_backend_logic.recommendedAgent).toBeNull()
      expect(matrix.general.recommendedAgent).toBeNull()
    })
  })

  describe('role-fit markdown generation', () => {
    it('generates correct markdown output matching snapshot', () => {
      const summaryRows = [
        { agent: 'kimi', runs: 10, qualityScore: 2.5, successRate: 0.8, timedOutRate: 0.1, medianDurationMs: 1000 },
        { agent: 'gemini', runs: 5, qualityScore: 1.8, successRate: 0.6, timedOutRate: 0.2, medianDurationMs: 2000 },
      ]

      const matrix = {
        ui_refactor: { recommendedAgent: 'kimi', scores: [{ agent: 'kimi', score: 2.5 }, { agent: 'gemini', score: 1.2 }] },
        api_backend_logic: { recommendedAgent: 'gemini', scores: [{ agent: 'gemini', score: 2.1 }, { agent: 'kimi', score: 1.8 }] },
        test_authoring: { recommendedAgent: 'kimi', scores: [{ agent: 'kimi', score: 2.2 }] },
        migration_security: { recommendedAgent: null, scores: [] },
        doc_process: { recommendedAgent: 'kimi', scores: [{ agent: 'kimi', score: 1.9 }, { agent: 'gemini', score: 1.5 }] },
        general: { recommendedAgent: null, scores: [] },
      }

      const generatedAt = '2026-02-27T00:00:00.000Z'
      const markdown = generateRoleFitMarkdown(summaryRows, matrix, generatedAt)

      // Verify structure with textual assertions
      expect(markdown).toContain('# Agent Role-Fit Recommendation')
      expect(markdown).toContain('Generated at: 2026-02-27T00:00:00.000Z')
      expect(markdown).toContain('## Agent Scores')
      expect(markdown).toContain('## Capability Matrix')

      // Verify table headers
      expect(markdown).toContain('| agent | runs | quality_score | success_rate | timed_out_rate | median_duration_ms |')
      expect(markdown).toContain('| task_type | recommended_agent | notes |')

      // Verify agent data rows
      expect(markdown).toContain('| kimi | 10 | 2.5 | 80% | 10% | 1000 |')
      expect(markdown).toContain('| gemini | 5 | 1.8 | 60% | 20% | 2000 |')

      // Verify matrix rows with recommendations
      expect(markdown).toContain('| ui_refactor | kimi |')
      expect(markdown).toContain('| api_backend_logic | gemini |')
      expect(markdown).toContain('| test_authoring | kimi |')
      expect(markdown).toContain('| migration_security | none | no-data')
      expect(markdown).toContain('| doc_process | kimi |')
      expect(markdown).toContain('| general | none | no-data')

      // Verify score formatting in notes
      expect(markdown).toContain('kimi:2.5, gemini:1.2')
      expect(markdown).toContain('gemini:2.1, kimi:1.8')
    })

    it('generates markdown usable by PM routing', () => {
      const summaryRows = [
        { agent: 'kimi', runs: 42, qualityScore: 2.618, successRate: 0.21, timedOutRate: 0.07, medianDurationMs: 541 },
        { agent: 'gemini', runs: 15, qualityScore: 1.253, successRate: 0.4, timedOutRate: 0.6, medianDurationMs: 180072 },
      ]

      const matrix = {
        ui_refactor: { recommendedAgent: 'kimi', scores: [{ agent: 'kimi', score: 2.569 }, { agent: 'gemini', score: 1.253 }] },
        api_backend_logic: { recommendedAgent: null, scores: [] },
        test_authoring: { recommendedAgent: null, scores: [] },
        migration_security: { recommendedAgent: null, scores: [] },
        doc_process: { recommendedAgent: null, scores: [] },
        general: { recommendedAgent: 'kimi', scores: [{ agent: 'kimi', score: 0.4 }] },
      }

      const markdown = generateRoleFitMarkdown(summaryRows, matrix, '2026-02-27T05:51:28.856Z')

      // PM routing should be able to parse recommended_agent column
      const lines = markdown.split('\n')
      const matrixSection = lines.findIndex(l => l.includes('## Capability Matrix'))
      const matrixRows = lines.slice(matrixSection + 3).filter(l => l.startsWith('|') && l.includes('task_type') === false)

      // Each row should have format: | task_type | recommended_agent | notes |
      for (const row of matrixRows) {
        const cells = row.split('|').map(c => c.trim()).filter(c => c !== '' && c !== '---')
        if (cells.length === 0) continue
        expect(cells).toHaveLength(3)
        expect(['ui_refactor', 'api_backend_logic', 'test_authoring', 'migration_security', 'doc_process', 'general']).toContain(cells[0])
      }
    })
  })
})
