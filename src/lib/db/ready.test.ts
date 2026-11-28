// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { setDbForTesting } from './client'
import { resetSchemaStateForTesting } from './migrate'
import { createTestDb } from '@/test/utils/test-db'

vi.mock('@/lib/logger', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }))

// vitest.setup.ts replaces the gate with a no-op for every other test; use the real one here.
const { ensureDatabaseReady, DatabaseNotReadyError } = await vi.importActual<typeof import('./ready')>('./ready')

const savedUrls = { DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL }

beforeEach(() => {
  resetSchemaStateForTesting()
})

afterEach(() => {
  for (const [key, value] of Object.entries(savedUrls)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  setDbForTesting(null)
  resetSchemaStateForTesting()
})

describe('ensureDatabaseReady', () => {
  it('serves once the schema is applied', async () => {
    const db = await createTestDb()
    setDbForTesting(db)

    await expect(ensureDatabaseReady()).resolves.toBeUndefined()
    const result = await db.execute(sql`select count(*)::int as n from app_schema_migrations`)
    expect((result as unknown as { rows: Array<{ n: number }> }).rows[0].n).toBeGreaterThan(0)
  })

  it('fails closed when there is no database configured', async () => {
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL

    await expect(ensureDatabaseReady()).rejects.toBeInstanceOf(DatabaseNotReadyError)
  })
})
