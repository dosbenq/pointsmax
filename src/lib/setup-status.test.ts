// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setDbForTesting } from '@/lib/db/client'
import { resetSchemaStateForTesting } from '@/lib/db/migrate'
import type { SourceReader } from '@/lib/db/supabase-import'
import { createTestDb } from '@/test/utils/test-db'
import { runSetupCheck, sanitizeError } from './setup-status'

const ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const
let saved: Partial<Record<(typeof ENV_KEYS)[number], string>>

const emptyReader: SourceReader = { readAll: async () => ({ rows: [], missing: false }) }

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
  resetSchemaStateForTesting()
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
    const status = await runSetupCheck(() => emptyReader)
    expect(status.configured.database_url).toBe(false)
    expect(status.schema).toEqual({ ok: false, error: 'DATABASE_URL is not set' })
    expect(status.rehearsal).toBeUndefined()
  })

  it('applies the schema and rehearses the copy when everything is set', async () => {
    process.env.POSTGRES_URL = 'postgres://placeholder'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    setDbForTesting(await createTestDb())

    const status = await runSetupCheck(() => emptyReader)
    expect(status.configured).toMatchObject({ database_url: true, supabase_source: true })
    expect(status.schema).toMatchObject({ ok: true })
    expect(status.import_complete).toBe(false)
    expect(status.rehearsal).toMatchObject({ ok: true, status: 'rehearsed', duplicateEmails: 0 })
  })

  it('skips the rehearsal without Supabase credentials', async () => {
    process.env.DATABASE_URL = 'postgres://placeholder'
    setDbForTesting(await createTestDb())

    const status = await runSetupCheck(() => emptyReader)
    expect(status.rehearsal).toEqual({ ok: null, skipped: 'Supabase credentials are not set' })
  })

  it('reports a failed rehearsal without leaking connection details', async () => {
    process.env.DATABASE_URL = 'postgres://placeholder'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    setDbForTesting(await createTestDb())
    const failing: SourceReader = {
      readAll: async () => {
        throw new Error('connect failed for postgres://user:pw@db.example.com/postgres')
      },
    }

    const status = await runSetupCheck(() => failing)
    expect(status.rehearsal).toEqual({ ok: false, error: 'connect failed for [database-url]' })
  })
})

describe('sanitizeError', () => {
  it('hides tokens and secrets', () => {
    expect(sanitizeError(new Error('bad key=abc123 token eyJhbGciOi.eyJzdWIi.c2lnbmF0dXJl'))).toBe('bad key=[hidden] token [token]')
  })
})
