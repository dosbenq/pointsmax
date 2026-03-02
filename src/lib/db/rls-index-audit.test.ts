// ============================================================
// RLS Index Audit Tests
// Verifies that every required RLS-supporting index is defined
// in its expected migration file, using static file content.
// No database connection required.
// ============================================================

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  RLS_INDEX_REQUIREMENTS,
  RLS_PROTECTED_USER_TABLES,
  sqlSatisfiesRequirement,
} from './rls-index-audit'

const MIGRATIONS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../../supabase/migrations'
)

function readMigration(filename: string): string {
  const filepath = path.join(MIGRATIONS_DIR, filename)
  if (!fs.existsSync(filepath)) return ''
  return fs.readFileSync(filepath, 'utf-8')
}

// ──────────────────────────────────────────────────────────────────
// Static schema audit: all required indexes are present in migrations
// ──────────────────────────────────────────────────────────────────

describe('RLS index coverage — static migration audit', () => {
  for (const requirement of RLS_INDEX_REQUIREMENTS) {
    it(`${requirement.table}(${requirement.column}) index is defined`, () => {
      const combinedSql = requirement.files.map(readMigration).join('\n')
      expect(
        combinedSql.length,
        `Migration file(s) not found: ${requirement.files.join(', ')}`
      ).toBeGreaterThan(0)
      expect(
        sqlSatisfiesRequirement(requirement, combinedSql),
        `Expected index pattern not found.\nIndex: ${requirement.name}\nFiles: ${requirement.files.join(', ')}\nNotes: ${requirement.notes}`
      ).toBe(true)
    })
  }
})

// ──────────────────────────────────────────────────────────────────
// Migration 025 specifically: new indexes added for RLS hardening
// ──────────────────────────────────────────────────────────────────

describe('migration 025 — RLS index hardening', () => {
  const sql025 = readMigration('025_rls_index_hardening.sql')

  it('migration file exists', () => {
    expect(sql025.length).toBeGreaterThan(0)
  })

  it('adds idx_alert_subscriptions_user_id as partial index', () => {
    expect(sql025).toMatch(/CREATE INDEX IF NOT EXISTS\s+idx_alert_subscriptions_user_id/i)
    expect(sql025).toMatch(/WHERE user_id IS NOT NULL/i)
  })

  it('adds idx_flight_watches_user_id as btree index', () => {
    expect(sql025).toMatch(/CREATE INDEX IF NOT EXISTS\s+idx_flight_watches_user_id/i)
    expect(sql025).toMatch(/ON public\.flight_watches\(user_id\)/i)
  })

  it('uses IF NOT EXISTS on both new indexes (safe to re-run)', () => {
    const matches = sql025.match(/CREATE INDEX IF NOT EXISTS/gi) ?? []
    expect(matches.length).toBe(2)
  })

  it('contains no destructive statements (DROP TABLE / TRUNCATE)', () => {
    expect(sql025).not.toMatch(/\bDROP TABLE\b/i)
    expect(sql025).not.toMatch(/\bTRUNCATE\b/i)
    expect(sql025).not.toMatch(/\bDELETE FROM\b/i)
  })

  it('does not modify or drop any RLS policies', () => {
    expect(sql025).not.toMatch(/\bDROP POLICY\b/i)
    expect(sql025).not.toMatch(/\bALTER POLICY\b/i)
    expect(sql025).not.toMatch(/\bDISABLE ROW LEVEL SECURITY\b/i)
  })
})

// ──────────────────────────────────────────────────────────────────
// sqlSatisfiesRequirement helper unit tests
// ──────────────────────────────────────────────────────────────────

describe('sqlSatisfiesRequirement', () => {
  const mockReq = RLS_INDEX_REQUIREMENTS.find(
    (r) => r.table === 'alert_subscriptions'
  )!

  it('returns true when the pattern is present in SQL', () => {
    const sql =
      'CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user_id\n  ON public.alert_subscriptions(user_id)\n  WHERE user_id IS NOT NULL;'
    expect(sqlSatisfiesRequirement(mockReq, sql)).toBe(true)
  })

  it('returns false when the pattern is absent from SQL', () => {
    const sql = 'CREATE TABLE foo (id UUID PRIMARY KEY);'
    expect(sqlSatisfiesRequirement(mockReq, sql)).toBe(false)
  })

  it('returns false for empty SQL', () => {
    expect(sqlSatisfiesRequirement(mockReq, '')).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────
// RLS_PROTECTED_USER_TABLES constants
// ──────────────────────────────────────────────────────────────────

describe('RLS_PROTECTED_USER_TABLES', () => {
  it('includes all user-linked tables with RLS policies', () => {
    expect(RLS_PROTECTED_USER_TABLES).toContain('user_balances')
    expect(RLS_PROTECTED_USER_TABLES).toContain('user_preferences')
    expect(RLS_PROTECTED_USER_TABLES).toContain('alert_subscriptions')
    expect(RLS_PROTECTED_USER_TABLES).toContain('flight_watches')
  })

  it('does not include public read-only tables', () => {
    expect(RLS_PROTECTED_USER_TABLES).not.toContain('programs')
    expect(RLS_PROTECTED_USER_TABLES).not.toContain('cards')
    expect(RLS_PROTECTED_USER_TABLES).not.toContain('knowledge_docs')
  })
})
