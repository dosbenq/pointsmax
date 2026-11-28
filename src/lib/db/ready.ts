// ============================================================
// The database is "ready" once the schema is applied and the one-off copy
// from Supabase has finished. Everything that reads or writes user data
// waits for this, so nobody is ever served an empty Neon in the meantime.
// ============================================================

import { getDb } from './client'
import { ensureSchema } from './migrate'
import {
  createSupabaseReader,
  importFromSupabase,
  isSupabaseImportComplete,
  type SourceReader,
  type SupabaseLike,
} from './supabase-import'
import { createAdminClient } from '@/lib/supabase'
import { logError, logInfo } from '@/lib/logger'

export class DatabaseNotReadyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseNotReadyError'
  }
}

function hasSupabaseSource(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

async function prepare(createReader: () => SourceReader): Promise<void> {
  const db = getDb()
  await ensureSchema(() => db)
  if (await isSupabaseImportComplete(db)) return

  if (!hasSupabaseSource()) {
    // Local development and CI have nothing to copy. Production must never
    // start serving user data without the copy.
    if (process.env.VERCEL_ENV === 'production') {
      throw new DatabaseNotReadyError('The copy from Supabase has not run and Supabase credentials are missing')
    }
    return
  }

  const report = await importFromSupabase(db, createReader(), { dryRun: false })
  logInfo('supabase_import_finished', { status: report.status, tables: report.tables })
}

type ReadyState = { promise: Promise<void>; failedAt?: number }
const RETRY_AFTER_FAILURE_MS = 30_000

/** Resolves once user data can be served; throws DatabaseNotReadyError otherwise. Shared per instance. */
export function ensureDatabaseReady(
  createReader: () => SourceReader = () => createSupabaseReader(createAdminClient() as unknown as SupabaseLike),
): Promise<void> {
  const g = globalThis as typeof globalThis & { __pointsmaxDbReady?: ReadyState }
  const state = g.__pointsmaxDbReady
  if (state && (state.failedAt === undefined || Date.now() - state.failedAt < RETRY_AFTER_FAILURE_MS)) {
    return state.promise
  }

  const next: ReadyState = {
    promise: prepare(createReader).catch((error: unknown) => {
      next.failedAt = Date.now()
      const message = error instanceof Error ? error.message : String(error)
      logError('database_not_ready', { error: message })
      throw error instanceof DatabaseNotReadyError ? error : new DatabaseNotReadyError(message)
    }),
  }
  g.__pointsmaxDbReady = next
  return next.promise
}

/** Tests only. */
export function resetDatabaseReadyForTesting(): void {
  const g = globalThis as typeof globalThis & { __pointsmaxDbReady?: ReadyState }
  delete g.__pointsmaxDbReady
}
