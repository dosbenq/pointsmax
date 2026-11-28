// ============================================================
// The database is "ready" once the schema is applied. Everything that reads
// or writes user data waits for this and answers 503 when it fails, so a
// missing DATABASE_URL or a Neon outage never looks like an empty account.
// ============================================================

import { getDb } from './client'
import { ensureSchema } from './migrate'
import { logError } from '@/lib/logger'

export class DatabaseNotReadyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseNotReadyError'
  }
}

/** Resolves once user data can be served; throws DatabaseNotReadyError otherwise. */
export async function ensureDatabaseReady(): Promise<void> {
  try {
    // ensureSchema is shared per server instance and retried 30s after a failure.
    await ensureSchema(getDb)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logError('database_not_ready', { error: message })
    throw error instanceof DatabaseNotReadyError ? error : new DatabaseNotReadyError(message)
  }
}
