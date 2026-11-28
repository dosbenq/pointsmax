// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDbForTesting } from '@/lib/db/client'
import { ensureDatabaseReady } from '@/lib/db/ready'
import { resetSchemaStateForTesting } from '@/lib/db/migrate'
import { dataImports } from '@/lib/db/schema'
import { SUPABASE_IMPORT_ID } from '@/lib/db/supabase-import'
import { createTestDb } from '@/test/utils/test-db'
import { runSetupCheck, sanitizeError } from './setup-status'

const ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL'] as const
let saved: Partial<Record<(typeof ENV_KEYS)[number], string>>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
  resetSchemaStateForTesting()
  vi.mocked(ensureDatabaseReady).mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  setDbForTesting(null)
  resetSchemaStateForTesting()
})

describe('runSetupCheck', () => {
  it('stops early when no database is configured', async () => {
    const status = await runSetupCheck()
    expect(status.configured.database_url).toBe(false)
    expect(status.schema).toEqual({ ok: false, error: 'DATABASE_URL is not set' })
    expect(status.import).toBeUndefined()
  })

  it('reports the completed copy with its per-table counts', async () => {
    process.env.POSTGRES_URL = 'postgres://placeholder'
    const db = await createTestDb()
    setDbForTesting(db)
    await db.insert(dataImports).values({ id: SUPABASE_IMPORT_ID, counts: { users: { source: 3, written: 3, skipped: 0 } } })

    const status = await runSetupCheck()
    expect(status.schema).toMatchObject({ ok: true })
    expect(status.import).toMatchObject({ ok: true, complete: true, tables: { users: { source: 3, written: 3, skipped: 0 } } })
  })

  it('reports a failed copy without leaking connection details', async () => {
    process.env.DATABASE_URL = 'postgres://placeholder'
    setDbForTesting(await createTestDb())
    vi.mocked(ensureDatabaseReady).mockRejectedValue(new Error('connect failed for postgres://user:pw@db.example.com/postgres'))

    const status = await runSetupCheck()
    expect(status.import).toEqual({ ok: false, error: 'connect failed for [database-url]' })
  })
})

describe('sanitizeError', () => {
  it('hides tokens and secrets', () => {
    expect(sanitizeError(new Error('bad key=abc123 token eyJhbGciOi.eyJzdWIi.c2lnbmF0dXJl'))).toBe('bad key=[hidden] token [token]')
  })
})
