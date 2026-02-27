#!/usr/bin/env node

/**
 * Unit tests for check-changed-test-policy.mjs
 * 
 * These tests use sample diffs and file lists to validate the policy logic
 * without requiring actual git operations.
 */

import { describe, it, expect } from 'vitest'
import {
  parseDiff,
  categorizeFiles,
  checkViolations,
  outputResults,
} from './check-changed-test-policy.mjs'

describe('check-changed-test-policy', () => {
  describe('parseDiff', () => {
    it('should extract changed files from git diff output', () => {
      const diff = `diff --git a/src/app/api/users/route.ts b/src/app/api/users/route.ts
index 1234..5678 100644
--- a/src/app/api/users/route.ts
+++ b/src/app/api/users/route.ts
@@ -1,5 +1,5 @@
 export async function GET() {
-  return Response.json({ users: [] })
+  return Response.json({ users: [], meta: {} })
 }
`
      const result = parseDiff(diff)
      expect(result.changed).toContain('src/app/api/users/route.ts')
    })

    it('should handle multiple file changes', () => {
      const diff = `diff --git a/src/app/api/users/route.ts b/src/app/api/users/route.ts
index 1234..5678 100644
--- a/src/app/api/users/route.ts
+++ b/src/app/api/users/route.ts
@@ -1 +1 @@
-export const a = 1
+export const a = 2
\ No newline at end of file
diff --git a/src/features/auth/ui/login.tsx b/src/features/auth/ui/login.tsx
index abcd..efgh 100644
--- a/src/features/auth/ui/login.tsx
+++ b/src/features/auth/ui/login.tsx
@@ -1 +1 @@
-export const Login = () => <div>Login</div>
+export const Login = () => <div>Sign In</div>
\ No newline at end of file
`
      const result = parseDiff(diff)
      expect(result.changed).toHaveLength(2)
      expect(result.changed).toContain('src/app/api/users/route.ts')
      expect(result.changed).toContain('src/features/auth/ui/login.tsx')
    })

    it('should handle empty diff', () => {
      const result = parseDiff('')
      expect(result.changed).toHaveLength(0)
      expect(result.added).toHaveLength(0)
      expect(result.deleted).toHaveLength(0)
    })
  })

  describe('categorizeFiles', () => {
    it('should categorize API source files', () => {
      const files = [
        'src/app/api/users/route.ts',
        'src/app/api/orders/route.ts',
        'src/lib/utils.ts',
      ]
      const result = categorizeFiles(files)
      
      expect(result.apiSource).toHaveLength(2)
      expect(result.apiSource).toContain('src/app/api/users/route.ts')
      expect(result.apiSource).toContain('src/app/api/orders/route.ts')
      expect(result.sourceFiles).toHaveLength(3)
    })

    it('should categorize API test files', () => {
      const files = [
        'src/app/api/users/route.ts',
        'src/app/api/users/route.test.ts',
        'src/app/api/orders/route.test.ts',
      ]
      const result = categorizeFiles(files)
      
      expect(result.apiTests).toHaveLength(2)
      expect(result.apiTests).toContain('src/app/api/users/route.test.ts')
      expect(result.testFiles).toHaveLength(2)
    })

    it('should categorize Feature UI source files', () => {
      const files = [
        'src/features/calculator-shell/ui/action-strip.tsx',
        'src/features/auth/ui/login.tsx',
        'src/lib/utils.ts',
      ]
      const result = categorizeFiles(files)
      
      expect(result.featureUiSource).toHaveLength(2)
      expect(result.featureUiSource).toContain('src/features/calculator-shell/ui/action-strip.tsx')
    })

    it('should categorize Feature test files', () => {
      const files = [
        'src/features/calculator-shell/__tests__/action-strip.test.tsx',
        'src/features/auth/ui/login.tsx',
      ]
      const result = categorizeFiles(files)
      
      expect(result.featureTests).toHaveLength(1)
      expect(result.featureTests).toContain('src/features/calculator-shell/__tests__/action-strip.test.tsx')
    })

    it('should categorize component test files', () => {
      const files = [
        'src/app/[region]/calculator/components/action-strip.test.tsx',
        'src/app/[region]/award-search/components/results.test.tsx',
      ]
      const result = categorizeFiles(files)
      
      expect(result.componentTests).toHaveLength(2)
    })

    it('should exclude test files from source files', () => {
      const files = [
        'src/app/api/users/route.ts',
        'src/app/api/users/route.test.ts',
        'src/lib/calculate.ts',
      ]
      const result = categorizeFiles(files)
      
      expect(result.sourceFiles).toHaveLength(2)
      expect(result.sourceFiles).not.toContain('src/app/api/users/route.test.ts')
      expect(result.testFiles).toHaveLength(1)
    })

    it('should handle empty file list', () => {
      const result = categorizeFiles([])
      
      expect(result.sourceFiles).toHaveLength(0)
      expect(result.testFiles).toHaveLength(0)
      expect(result.apiSource).toHaveLength(0)
      expect(result.apiTests).toHaveLength(0)
    })

    it('should ignore non-source files', () => {
      const files = [
        'README.md',
        '.github/workflows/ci.yml',
        'package.json',
        'docs/api.md',
      ]
      const result = categorizeFiles(files)
      
      expect(result.sourceFiles).toHaveLength(0)
      expect(result.testFiles).toHaveLength(0)
    })
  })

  describe('checkViolations', () => {
    it('should pass when no source files changed', () => {
      const categories = {
        sourceFiles: [],
        testFiles: [],
        apiSource: [],
        apiTests: [],
        featureUiSource: [],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should pass when only test files changed', () => {
      const categories = {
        sourceFiles: [],
        testFiles: ['src/app/api/users/route.test.ts'],
        apiSource: [],
        apiTests: ['src/app/api/users/route.test.ts'],
        featureUiSource: [],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(true)
    })

    it('should pass when API changes include API tests', () => {
      const categories = {
        sourceFiles: ['src/app/api/users/route.ts'],
        testFiles: ['src/app/api/users/route.test.ts'],
        apiSource: ['src/app/api/users/route.ts'],
        apiTests: ['src/app/api/users/route.test.ts'],
        featureUiSource: [],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(true)
    })

    it('should fail when API changes without API tests', () => {
      const categories = {
        sourceFiles: ['src/app/api/users/route.ts'],
        testFiles: [],
        apiSource: ['src/app/api/users/route.ts'],
        apiTests: [],
        featureUiSource: [],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(false)
      expect(result.violations).toHaveLength(2)
      expect(result.violations.some(v => v.rule === 'api-test-required')).toBe(true)
      expect(result.violations.some(v => v.rule === 'general-test-required')).toBe(true)
    })

    it('should pass when Feature UI changes include feature tests', () => {
      const categories = {
        sourceFiles: ['src/features/auth/ui/login.tsx'],
        testFiles: ['src/features/auth/__tests__/login.test.tsx'],
        apiSource: [],
        apiTests: [],
        featureUiSource: ['src/features/auth/ui/login.tsx'],
        featureTests: ['src/features/auth/__tests__/login.test.tsx'],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(true)
    })

    it('should fail when Feature UI changes without feature tests', () => {
      const categories = {
        sourceFiles: ['src/features/auth/ui/login.tsx'],
        testFiles: [],
        apiSource: [],
        apiTests: [],
        featureUiSource: ['src/features/auth/ui/login.tsx'],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(false)
      expect(result.violations.some(v => v.rule === 'feature-test-required')).toBe(true)
      expect(result.violations.some(v => v.rule === 'general-test-required')).toBe(true)
    })

    it('should pass when non-API source changes include tests', () => {
      const categories = {
        sourceFiles: ['src/lib/calculate.ts'],
        testFiles: ['src/lib/calculate.test.ts'],
        apiSource: [],
        apiTests: [],
        featureUiSource: [],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(true)
    })

    it('should fail when source changes without any tests', () => {
      const categories = {
        sourceFiles: ['src/lib/calculate.ts'],
        testFiles: [],
        apiSource: [],
        apiTests: [],
        featureUiSource: [],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0].rule).toBe('general-test-required')
    })

    it('should handle multiple violations', () => {
      const categories = {
        sourceFiles: [
          'src/app/api/users/route.ts',
          'src/features/auth/ui/login.tsx',
        ],
        testFiles: [],
        apiSource: ['src/app/api/users/route.ts'],
        apiTests: [],
        featureUiSource: ['src/features/auth/ui/login.tsx'],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.pass).toBe(false)
      expect(result.violations).toHaveLength(3)
      expect(result.violations.some(v => v.rule === 'api-test-required')).toBe(true)
      expect(result.violations.some(v => v.rule === 'feature-test-required')).toBe(true)
      expect(result.violations.some(v => v.rule === 'general-test-required')).toBe(true)
    })

    it('should include file lists in violations', () => {
      const categories = {
        sourceFiles: ['src/app/api/users/route.ts'],
        testFiles: [],
        apiSource: ['src/app/api/users/route.ts'],
        apiTests: [],
        featureUiSource: [],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      const apiViolation = result.violations.find(v => v.rule === 'api-test-required')
      expect(apiViolation.files).toContain('src/app/api/users/route.ts')
    })

    it('should provide accurate summary', () => {
      const categories = {
        sourceFiles: ['src/app/api/users/route.ts', 'src/lib/utils.ts'],
        testFiles: ['src/lib/utils.test.ts'],
        apiSource: ['src/app/api/users/route.ts'],
        apiTests: [],
        featureUiSource: [],
        featureTests: [],
        componentTests: [],
      }
      const result = checkViolations(categories)
      
      expect(result.summary.sourceFiles).toBe(2)
      expect(result.summary.testFiles).toBe(1)
      expect(result.summary.apiSource).toBe(1)
      expect(result.summary.apiTests).toBe(0)
    })
  })

  describe('outputResults', () => {
    it('should log success for passing result', () => {
      const logs = []
      const errors = []
      const output = {
        log: (msg) => logs.push(msg),
        error: (msg) => errors.push(msg),
      }
      
      const result = {
        pass: true,
        filesChanged: 5,
        summary: { sourceFiles: 3, testFiles: 2 },
        violations: [],
      }
      
      outputResults(result, output)
      
      expect(logs.some(l => l.includes('passed'))).toBe(true)
      expect(errors).toHaveLength(0)
    })

    it('should log violations for failing result', () => {
      const logs = []
      const errors = []
      const output = {
        log: (msg) => logs.push(msg),
        error: (msg) => errors.push(msg),
      }
      
      const result = {
        pass: false,
        filesChanged: 2,
        summary: { sourceFiles: 2, testFiles: 0 },
        violations: [
          { rule: 'api-test-required', message: 'API changed but no tests', files: ['src/app/api/route.ts'] },
        ],
        mode: 'enforce',
        dryRun: false,
      }
      
      outputResults(result, output)
      
      expect(errors.some(e => e.includes('violations'))).toBe(true)
      expect(errors.some(e => e.includes('API changed but no tests'))).toBe(true)
    })

    it('should limit file list output to 3 files', () => {
      const logs = []
      const errors = []
      const output = {
        log: (msg) => logs.push(msg),
        error: (msg) => errors.push(msg),
      }
      
      const result = {
        pass: false,
        filesChanged: 5,
        summary: { sourceFiles: 5, testFiles: 0 },
        violations: [
          { 
            rule: 'api-test-required', 
            message: 'API changed', 
            files: ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts'] 
          },
        ],
        mode: 'enforce',
        dryRun: false,
      }
      
      outputResults(result, output)
      
      // Should show first 3 files and "... and X more"
      expect(errors.filter(e => e.includes('file1.ts') || e.includes('file2.ts') || e.includes('file3.ts'))).toHaveLength(3)
      expect(errors.some(e => e.includes('and 2 more'))).toBe(true)
    })

    it('should include mode info in output', () => {
      const logs = []
      const errors = []
      const output = {
        log: (msg) => logs.push(msg),
        error: (msg) => errors.push(msg),
      }
      
      const result = {
        pass: false,
        filesChanged: 1,
        summary: { sourceFiles: 1, testFiles: 0 },
        violations: [{ rule: 'test-required', message: 'No tests', files: [] }],
        mode: 'warn',
        dryRun: false,
      }
      
      outputResults(result, output)
      
      expect(errors.some(e => e.includes('Mode: warn'))).toBe(true)
    })
  })
})
