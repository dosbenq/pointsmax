import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  LOGS_DIR,
  RUBRIC_PATH,
  main,
  parseOutbox,
  parseTaskFrontmatter,
  validateRubric,
} from './evaluate.mjs'

describe('scripts/agents/evaluate.mjs', () => {
  it('validates rubric shape and weights', async () => {
    const rubricRaw = await fs.readFile(RUBRIC_PATH, 'utf8')
    const rubric = JSON.parse(rubricRaw)
    expect(validateRubric(rubric)).toBe(true)

    expect(() => validateRubric({})).toThrow('rubric.weights must be an object')
  })

  it('parses task frontmatter and body', () => {
    const content = `---
id: TASK-9000
title: Example Task
owner: kimi
---

## Objective
Ship something`

    const parsed = parseTaskFrontmatter(content)
    expect(parsed.id).toBe('TASK-9000')
    expect(parsed.title).toBe('Example Task')
    expect(parsed.body).toContain('## Objective')
  })

  it('parses outbox status metadata', () => {
    const content = `# TASK-9000 · kimi run

- status: blocked
- timed_out: true
- duration_ms: 1234`

    const parsed = parseOutbox(content, 'agents/outbox/kimi/TASK-9000.md', 'kimi')
    expect(parsed.taskId).toBe('TASK-9000')
    expect(parsed.status).toBe('blocked')
    expect(parsed.timedOut).toBe(true)
    expect(parsed.durationMs).toBe(1234)
    expect(parsed.reworkPatches).toBe(1)
  })

  it('writes evaluation artifacts from current outbox data', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await main()
    } finally {
      logSpy.mockRestore()
    }

    const today = new Date().toISOString().slice(0, 10)
    const jsonPath = path.join(LOGS_DIR, `agent-eval-${today}.json`)
    const markdownPath = path.join(LOGS_DIR, 'agent-role-fit-latest.md')

    const [artifactRaw, markdown] = await Promise.all([
      fs.readFile(jsonPath, 'utf8'),
      fs.readFile(markdownPath, 'utf8'),
    ])

    const artifact = JSON.parse(artifactRaw)
    expect(Array.isArray(artifact.runs)).toBe(true)
    expect(Array.isArray(artifact.summary)).toBe(true)
    expect(typeof artifact.capability_matrix).toBe('object')
    expect(markdown).toContain('# Agent Role-Fit Recommendation')
    expect(markdown).toContain('## Capability Matrix')
  })
})
