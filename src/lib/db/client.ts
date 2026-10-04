// ============================================================
// PointsMax — database client (Drizzle over postgres.js)
// DATABASE_URL is any Postgres connection string: Neon (use the pooled
// "-pooler" host in production) or, during the migration, Supabase.
// ============================================================

import { drizzle } from 'drizzle-orm/postgres-js'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

type DbGlobal = typeof globalThis & {
  __pointsmaxDb?: Database
  __pointsmaxDbOverride?: Database
}

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is not set — database unavailable')
  }
  return url
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim())
}

/** Shared Drizzle instance. One small pool per server instance. */
export function getDb(): Database {
  const g = globalThis as DbGlobal
  if (g.__pointsmaxDbOverride) return g.__pointsmaxDbOverride
  if (!g.__pointsmaxDb) {
    const client = postgres(resolveDatabaseUrl(), {
      max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '5', 10),
      // Transaction-mode poolers (Neon, Supabase) do not support prepared statements.
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    })
    g.__pointsmaxDb = drizzle(client, { schema }) as unknown as Database
  }
  return g.__pointsmaxDb
}

/** Tests: route getDb() to an in-memory database (see src/test/utils/test-db.ts). */
export function setDbForTesting(db: Database | null): void {
  const g = globalThis as DbGlobal
  g.__pointsmaxDbOverride = db ?? undefined
}

export { schema }
