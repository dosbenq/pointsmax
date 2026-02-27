#!/usr/bin/env node

import { execSync } from 'node:child_process'

const rawBase = process.env.BASE_SHA || 'HEAD~1'
const BASE = /^0+$/.test(rawBase) ? 'HEAD~1' : rawBase
const HEAD = process.env.HEAD_SHA || 'HEAD'
const MODE = (process.env.QUALITY_GATE_MODE || 'enforce').toLowerCase()

function runDiff() {
  try {
    return execSync(`git diff --unified=0 ${BASE}...${HEAD} -- '*.ts' '*.tsx'`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    if (error.stdout) return String(error.stdout)
    throw error
  }
}

const diff = runDiff()
const violations = []
let currentFile = ''

for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice(6)
    continue
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue
  if (line.includes('@any-waiver')) continue

  const isAny = /\bany\b/.test(line)
  const suspicious = /(:\s*any\b|\bas\s+any\b|<any>|Record<[^>]*\bany\b[^>]*>|\bany\[\])/.test(line)
  if (isAny && suspicious) {
    violations.push(`${currentFile}: ${line.slice(1).trim()}`)
  }
}

if (violations.length === 0) {
  console.log('No new disallowed any usage detected')
  process.exit(0)
}

console.error('New disallowed any usage detected:')
for (const v of violations) console.error(`- ${v}`)

if (MODE === 'warn') {
  console.error('QUALITY_GATE_MODE=warn -> continuing')
  process.exit(0)
}

process.exit(1)
