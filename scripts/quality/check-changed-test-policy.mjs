#!/usr/bin/env node

/**
 * Changed-scope test policy gate
 * 
 * Enforces that changes to specific source areas require corresponding test updates:
 * - API changes under src/app/api require API route tests
 * - Feature UI changes under src/features/<feature>/ui require component tests
 * - Any production source changes require at least one test update
 * 
 * Environment variables:
 * - BASE_SHA: base commit for comparison (default: HEAD~1)
 * - HEAD_SHA: head commit for comparison (default: HEAD)
 * - QUALITY_GATE_MODE: 'enforce' (default) or 'warn'
 * - DRY_RUN: 'true' to simulate without failing (for testing)
 */

import { execSync } from 'node:child_process'

// Configuration
const CONFIG = {
  apiPattern: /^src\/app\/api\/.+\.ts$/,
  apiTestPattern: /^src\/app\/api\/.+\.test\.ts$/,
  featureUiPattern: /^src\/features\/[^/]+\/ui\/.+\.(ts|tsx)$/,
  featureTestPattern: /^src\/features\/.+\.test\.(ts|tsx)$/,
  componentTestPattern: /^src\/app\/\[region\]\/[^/]+\/components\/.+\.test\.(ts|tsx)$/,
  sourcePattern: /^src\/.+\.(ts|tsx)$/,
  testPattern: /\.test\.(ts|tsx)$/,
}

/**
 * Get changed files between base and head commits
 * @param {string} base - Base commit SHA
 * @param {string} head - Head commit SHA
 * @returns {string[]} Array of changed file paths
 */
export function getChangedFiles(base, head) {
  try {
    const out = execSync(`git diff --name-only ${base}...${head}`, { encoding: 'utf8' })
    return out.split('\n').map((line) => line.trim()).filter(Boolean)
  } catch (error) {
    if (error.stdout) {
      return String(error.stdout).split('\n').map((line) => line.trim()).filter(Boolean)
    }
    throw error
  }
}

/**
 * Parse diff output and extract changed file information
 * @param {string} diff - Git diff output
 * @returns {Object} Object with arrays of changed, added, modified, deleted files
 */
export function parseDiff(diff) {
  const changed = new Set()
  const added = new Set()
  const modified = new Set()
  const deleted = new Set()

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) {
      // Extract file path from diff --git a/path b/path
      const match = line.match(/diff --git a\/(.+) b\/(.+)$/)
      if (match) {
        const filePath = match[2] // Use the 'b' side (new path)
        changed.add(filePath)
      }
    } else if (line.startsWith('--- a/')) {
      // Track deletions
      const filePath = line.slice(6).split('\t')[0]
      if (filePath !== '/dev/null') {
        deleted.add(filePath)
      }
    } else if (line.startsWith('+++ b/')) {
      // Track additions
      const filePath = line.slice(6).split('\t')[0]
      if (filePath !== '/dev/null') {
        added.add(filePath)
      }
    }
  }

  return {
    changed: Array.from(changed),
    added: Array.from(added),
    modified: Array.from(modified),
    deleted: Array.from(deleted),
  }
}

/**
 * Categorize files by type
 * @param {string[]} files - Array of file paths
 * @returns {Object} Categorized files
 */
export function categorizeFiles(files) {
  const sourceFiles = files.filter(f => CONFIG.sourcePattern.test(f) && !CONFIG.testPattern.test(f))
  const testFiles = files.filter(f => CONFIG.testPattern.test(f))
  
  return {
    sourceFiles,
    testFiles,
    apiSource: sourceFiles.filter(f => CONFIG.apiPattern.test(f)),
    apiTests: testFiles.filter(f => CONFIG.apiTestPattern.test(f)),
    featureUiSource: sourceFiles.filter(f => CONFIG.featureUiPattern.test(f)),
    featureTests: testFiles.filter(f => CONFIG.featureTestPattern.test(f)),
    componentTests: testFiles.filter(f => CONFIG.componentTestPattern.test(f)),
  }
}

/**
 * Check for policy violations
 * @param {Object} categories - Categorized file changes from categorizeFiles()
 * @returns {Object} Result with violations array and pass boolean
 */
export function checkViolations(categories) {
  const violations = []

  // Rule 1: API changes require API tests
  if (categories.apiSource.length > 0 && categories.apiTests.length === 0) {
    violations.push({
      rule: 'api-test-required',
      message: `API source changed (${categories.apiSource.length} file(s)) but no API tests were updated`,
      files: categories.apiSource,
    })
  }

  // Rule 2: Feature UI changes require feature component tests
  if (categories.featureUiSource.length > 0 && categories.featureTests.length === 0) {
    violations.push({
      rule: 'feature-test-required',
      message: `Feature UI changed (${categories.featureUiSource.length} file(s)) but no feature component tests were updated`,
      files: categories.featureUiSource,
    })
  }

  // Rule 3: Any production source changes require at least one test update
  if (categories.sourceFiles.length > 0 && categories.testFiles.length === 0) {
    violations.push({
      rule: 'general-test-required',
      message: `Production source changed (${categories.sourceFiles.length} file(s)) but no tests were updated`,
      files: categories.sourceFiles,
    })
  }

  return {
    pass: violations.length === 0,
    violations,
    summary: {
      sourceFiles: categories.sourceFiles.length,
      testFiles: categories.testFiles.length,
      apiSource: categories.apiSource.length,
      apiTests: categories.apiTests.length,
      featureUiSource: categories.featureUiSource.length,
      featureTests: categories.featureTests.length,
    },
  }
}

/**
 * Run the policy check
 * @param {Object} options - Options
 * @param {string} options.base - Base commit SHA
 * @param {string} options.head - Head commit SHA
 * @param {string} options.mode - 'enforce' or 'warn'
 * @param {boolean} options.dryRun - If true, don't exit with error
 * @returns {Object} Check result
 */
export function runPolicyCheck(options = {}) {
  const rawBase = options.base || process.env.BASE_SHA || 'HEAD~1'
  const base = /^0+$/.test(rawBase) ? 'HEAD~1' : rawBase
  const head = options.head || process.env.HEAD_SHA || 'HEAD'
  const mode = (options.mode || process.env.QUALITY_GATE_MODE || 'enforce').toLowerCase()
  const dryRun = options.dryRun || process.env.DRY_RUN === 'true'

  const files = getChangedFiles(base, head)
  const categories = categorizeFiles(files)
  const result = checkViolations(categories)

  return {
    ...result,
    mode,
    dryRun,
    base,
    head,
    filesChanged: files.length,
  }
}

/**
 * Format and output results
 * @param {Object} result - Check result from runPolicyCheck()
 * @param {Object} output - Output streams (for testing)
 */
export function outputResults(result, output = { log: console.log, error: console.error }) {
  if (result.pass) {
    output.log('✓ Changed-scope testing policy passed')
    output.log(`  Files changed: ${result.filesChanged}`)
    output.log(`  Source files: ${result.summary.sourceFiles}, Test files: ${result.summary.testFiles}`)
    return
  }

  output.error('✗ Changed-scope testing policy violations:')
  for (const violation of result.violations) {
    output.error(`  - ${violation.message}`)
    if (violation.files && violation.files.length > 0) {
      for (const file of violation.files.slice(0, 3)) {
        output.error(`      ${file}`)
      }
      if (violation.files.length > 3) {
        output.error(`      ... and ${violation.files.length - 3} more`)
      }
    }
  }

  output.error(`\nMode: ${result.mode}${result.dryRun ? ' (dry-run)' : ''}`)

  if (result.mode === 'warn' && !result.dryRun) {
    output.error('QUALITY_GATE_MODE=warn -> continuing')
  }
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1]

  const result = runPolicyCheck({ dryRun, mode })
  outputResults(result)

  if (result.dryRun) {
    outputResults({ 
      pass: true, 
      filesChanged: result.filesChanged,
      summary: result.summary,
      mode: result.mode,
      dryRun: result.dryRun,
      violations: []
    }, { log: console.log, error: console.error })
    console.log('\n(Dry run mode - no exit code enforced)')
    process.exit(0)
  }

  if (result.pass || result.mode === 'warn') {
    process.exit(0)
  }

  process.exit(1)
}

// Run main if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
