// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDbForTesting } from '@/lib/db/client'
import { ensureDatabaseReady } from '@/lib/db/ready'
import { resetSchemaStateForTesting } from '@/lib/db/migrate'
import { dataImports } from '@/lib/db/schema'
import { SUPABASE_IMPORT_ID } from '@/lib/db/supabase-import'
import { createTestDb } from '@/test/utils/test-db'
import { checkGoogleCredentials, runSetupCheck, sanitizeError } from './setup-status'

const ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const
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
    expect(status.import).toMatchObject({ ok: true, complete: true, tables: { users: { source: 3, written: 3, skipped: 0 } }, linked_profiles: 0 })
  })

  it('reports a failed copy without leaking connection details', async () => {
    process.env.DATABASE_URL = 'postgres://placeholder'
    setDbForTesting(await createTestDb())
    vi.mocked(ensureDatabaseReady).mockRejectedValue(new Error('connect failed for postgres://user:pw@db.example.com/postgres'))

    const status = await runSetupCheck()
    expect(status.import).toEqual({ ok: false, error: 'connect failed for [database-url]' })
  })
})

describe('checkGoogleCredentials', () => {
  const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('is skipped until both Google settings exist', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id'
    expect(await checkGoogleCredentials(answer(400, {}))).toEqual({ ok: null, skipped: 'Google credentials are not set' })
  })

  it('accepts credentials when Google only rejects the made-up code', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id'
    process.env.GOOGLE_CLIENT_SECRET = 'secret'
    expect(await checkGoogleCredentials(answer(400, { error: 'invalid_grant' }))).toEqual({ ok: true })
  })

  it('flags a wrong client secret', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id'
    process.env.GOOGLE_CLIENT_SECRET = 'wrong'
    expect(await checkGoogleCredentials(answer(401, { error: 'invalid_client' }))).toEqual({ ok: false, error: 'Google rejected the client ID or secret' })
  })

  it('reports anything else verbatim', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id'
    process.env.GOOGLE_CLIENT_SECRET = 'secret'
    expect(await checkGoogleCredentials(answer(400, { error: 'redirect_uri_mismatch' }))).toEqual({ ok: false, error: 'Unexpected answer from Google: redirect_uri_mismatch' })
  })
})

describe('sanitizeError', () => {
  it('hides tokens and secrets', () => {
    expect(sanitizeError(new Error('bad key=abc123 token eyJhbGciOi.eyJzdWIi.c2lnbmF0dXJl'))).toBe('bad key=[hidden] token [token]')
  })
})
