// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDbForTesting } from './client'
import { resetSchemaStateForTesting } from './migrate'
import { isSupabaseImportComplete, type SourceReader } from './supabase-import'
import { createTestDb } from '@/test/utils/test-db'

// vitest.setup.ts replaces the gate with a no-op for every other test; use the real one here.
const { ensureDatabaseReady, resetDatabaseReadyForTesting, DatabaseNotReadyError } =
  await vi.importActual<typeof import('./ready')>('./ready')

const ENV_KEYS = ['VERCEL_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const
let saved: Partial<Record<(typeof ENV_KEYS)[number], string>>

const ALICE = '11111111-1111-4111-8111-111111111111'
function readerWithOneUser(): SourceReader & { calls: number } {
  const reader = {
    calls: 0,
    async readAll(table: string) {
      reader.calls += 1
      return { rows: table === 'users' ? [{ id: ALICE, email: 'alice@example.com' }] : [], missing: false }
    },
  }
  return reader
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  resetDatabaseReadyForTesting()
  resetSchemaStateForTesting()
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  setDbForTesting(null)
  resetDatabaseReadyForTesting()
  resetSchemaStateForTesting()
})

describe('ensureDatabaseReady', () => {
  it('copies from Supabase once, then serves', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    const db = await createTestDb()
    setDbForTesting(db)
    const reader = readerWithOneUser()

    await Promise.all([ensureDatabaseReady(() => reader), ensureDatabaseReady(() => reader)])
    expect(await isSupabaseImportComplete(db)).toBe(true)
    const callsAfterImport = reader.calls

    resetDatabaseReadyForTesting() // a new server instance
    await ensureDatabaseReady(() => reader)
    expect(reader.calls).toBe(callsAfterImport) // marker found, nothing read again
  })

  it('refuses to serve production without the copy or a way to make it', async () => {
    process.env.VERCEL_ENV = 'production'
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    setDbForTesting(await createTestDb())

    await expect(ensureDatabaseReady(readerWithOneUser)).rejects.toBeInstanceOf(DatabaseNotReadyError)
  })

  it('is ready without a copy in development when there is no Supabase to copy from', async () => {
    delete process.env.VERCEL_ENV
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    setDbForTesting(await createTestDb())

    await expect(ensureDatabaseReady(readerWithOneUser)).resolves.toBeUndefined()
  })

  it('fails closed when the copy fails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    setDbForTesting(await createTestDb())
    const failing: SourceReader = { readAll: async () => { throw new Error('Supabase paused') } }

    await expect(ensureDatabaseReady(() => failing)).rejects.toThrow('Supabase paused')
  })
})
