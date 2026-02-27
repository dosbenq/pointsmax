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

function diffForFiles(files) {
  if (files.length === 0) return ''
  const quoted = files.map((f) => `'${f.replaceAll("'", "'\\''")}'`).join(' ')
  try {
    return execSync(`git diff --unified=0 ${BASE}...${HEAD} -- ${quoted}`, { encoding: 'utf8' })
  } catch (error) {
    if (error.stdout) return String(error.stdout)
    throw error
  }
}

const files = changedFiles().filter((file) =>
  file.startsWith('src/')
  && (file.endsWith('.ts') || file.endsWith('.tsx'))
  && !file.endsWith('.test.ts')
  && !file.endsWith('.test.tsx')
  && !file.includes('/__snapshots__/')
  && !file.startsWith('src/config/')
)

const diff = diffForFiles(files)
const violations = []
let currentFile = ''

for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice(6)
    continue
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue

  const added = line.slice(1)
  const urls = added.match(/https?:\/\/[^\s"'`]+/g) ?? []
  for (const url of urls) {
    if (url.includes('schema.org')) continue
    violations.push(`${currentFile}: ${url}`)
  }

  if (added.includes('https://pointsmax.com') || added.includes('http://localhost:3000')) {
    violations.push(`${currentFile}: app URL hardcoded in source`)
  }
}

if (violations.length === 0) {
  console.log('No new hardcoded production URLs/config links detected in feature source')
  process.exit(0)
}

console.error('Hardcoded URL/config guard violations:')
for (const v of violations) console.error(`- ${v}`)

if (MODE === 'warn') {
  console.error('QUALITY_GATE_MODE=warn -> continuing')
  process.exit(0)
}

process.exit(1)
