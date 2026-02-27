#!/usr/bin/env node

import { execSync } from 'node:child_process'

const rawBase = process.env.BASE_SHA || 'HEAD~1'
const BASE = /^0+$/.test(rawBase) ? 'HEAD~1' : rawBase
const HEAD = process.env.HEAD_SHA || 'HEAD'
const MODE = (process.env.QUALITY_GATE_MODE || 'enforce').toLowerCase()

function changedFiles() {
  try {
    const out = execSync(`git diff --name-only ${BASE}...${HEAD}`, { encoding: 'utf8' })
    return out.split('\n').map((line) => line.trim()).filter(Boolean)
  } catch (error) {
    if (error.stdout) {
      return String(error.stdout).split('\n').map((line) => line.trim()).filter(Boolean)
    }
    throw error
  }
}

const files = changedFiles()
const sourceChanged = files.filter((f) => /^src\/.*\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
const testsChanged = files.filter((f) => /\.test\.(ts|tsx)$/.test(f))
const apiSourceChanged = sourceChanged.filter((f) => f.startsWith('src/app/api/'))
const apiTestsChanged = testsChanged.filter((f) => f.startsWith('src/app/api/'))
const featureUiSourceChanged = sourceChanged.filter((f) => /^src\/features\/[^/]+\/ui\/.+\.(ts|tsx)$/.test(f))
const featureTestsChanged = testsChanged.filter((f) => /^src\/features\//.test(f))

const violations = []

if (apiSourceChanged.length > 0 && apiTestsChanged.length === 0) {
  violations.push('API source changed under src/app/api/** but no API tests were updated')
}

if (featureUiSourceChanged.length > 0 && featureTestsChanged.length === 0) {
  violations.push('Feature UI changed under src/features/**/ui/** but no feature component tests were updated')
}

if (sourceChanged.length > 0 && testsChanged.length === 0) {
  violations.push('Production source changed but no tests were updated')
}

if (violations.length === 0) {
  console.log('Changed-scope testing policy passed')
  process.exit(0)
}

console.error('Changed-scope testing policy violations:')
for (const violation of violations) console.error(`- ${violation}`)

if (MODE === 'warn') {
  console.error('QUALITY_GATE_MODE=warn -> continuing')
  process.exit(0)
}

process.exit(1)
