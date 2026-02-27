#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function listSourceFiles() {
  const output = execSync("rg --files src -g '*.ts' -g '*.tsx'", {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

function extractImports(content) {
  const imports = []
  const staticRe = /from\s+['"]([^'"]+)['"]/g
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g

  let match
  while ((match = staticRe.exec(content)) !== null) imports.push(match[1])
  while ((match = dynamicRe.exec(content)) !== null) imports.push(match[1])
  return imports
}

function featureOf(file) {
  const normalized = file.replaceAll('\\\\', '/')
  const match = normalized.match(/^src\/features\/([^/]+)\//)
  return match ? match[1] : null
}

function isFeatureInternalImport(spec) {
  if (!spec.startsWith('@/features/')) return false
  const parts = spec.replace('@/features/', '').split('/').filter(Boolean)
  return parts.length > 1 && parts[1] !== 'index'
}

const errors = []
const files = listSourceFiles()

const featureDirs = new Set()
for (const file of files) {
  const f = featureOf(file)
  if (f) featureDirs.add(f)
}

for (const feature of featureDirs) {
  const indexPath = path.join(ROOT, 'src', 'features', feature, 'index.ts')
  try {
    await fs.access(indexPath)
  } catch {
    errors.push(`Feature missing public API index: src/features/${feature}/index.ts`)
  }
}

for (const file of files) {
  const abs = path.join(ROOT, file)
  const content = await fs.readFile(abs, 'utf8')
  const imports = extractImports(content)
  const currentFeature = featureOf(file)

  for (const spec of imports) {
    if (file.startsWith('src/app/') && isFeatureInternalImport(spec)) {
      errors.push(`${file}: app layer imports feature internals (${spec}). Use @/features/<feature> only.`)
    }

    if (!currentFeature) continue

    if (spec.startsWith('@/app/')) {
      errors.push(`${file}: feature imports app layer (${spec})`)
    }

    if (spec.startsWith('@/features/')) {
      const parts = spec.replace('@/features/', '').split('/').filter(Boolean)
      const targetFeature = parts[0]
      const internal = parts.length > 1 && parts[1] !== 'index'
      if (targetFeature !== currentFeature && internal) {
        errors.push(`${file}: cross-feature internal import (${spec}). Use @/features/${targetFeature}.`)
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Feature boundary check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Feature boundary check passed')
