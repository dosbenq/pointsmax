#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const REQUIRED = [
  {
    file: 'Documentation/engineering/01-architecture.md',
    headings: ['Vertical Slice Standard', 'Dependency Rules', 'Anti-patterns'],
  },
  {
    file: 'Documentation/engineering/02-coding-standards.md',
    headings: ['TypeScript Strictness', 'Error Handling', 'Configuration and Environment'],
  },
  {
    file: 'Documentation/engineering/03-testing-strategy.md',
    headings: ['Test Pyramid', 'Required Tests by Change Type', 'Deterministic Rules'],
  },
  {
    file: 'Documentation/engineering/04-pr-review-checklist.md',
    headings: ['Definition of Done', 'Reviewer Reject Criteria'],
  },
  {
    file: 'Documentation/engineering/05-agent-contribution-contract.md',
    headings: ['Task Contract (Required)', 'Output Format (Required)', 'Review Handoff'],
  },
  {
    file: 'Documentation/engineering/06-release-quality-gates.md',
    headings: ['Mandatory CI Checks', 'Branch Protection Map'],
  },
]

const errors = []

for (const rule of REQUIRED) {
  const abs = path.join(ROOT, rule.file)
  let content = ''
  try {
    content = await fs.readFile(abs, 'utf8')
  } catch {
    errors.push(`Missing required doc: ${rule.file}`)
    continue
  }

  for (const heading of rule.headings) {
    if (!content.includes(`## ${heading}`)) {
      errors.push(`${rule.file} missing heading: "${heading}"`)
    }
  }
}

if (errors.length > 0) {
  console.error('Engineering docs check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Engineering docs check passed')
