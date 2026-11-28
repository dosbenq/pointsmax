// ============================================================
// PointsMax — database client (Drizzle over postgres.js, Neon in production)
// ============================================================

import { drizzle } from 'drizzle-orm/postgres-js'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from './schema'
import { getDatabaseUrl } from './url'

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

type DbGlobal = typeof globalThis & {
  __pointsmaxDb?: Database
  __pointsmaxDbOverride?: Database
}

/** Shared Drizzle instance: one small pool per server instance, opened on first use. */
export function getDb(): Database {
  const g = globalThis as DbGlobal
  if (g.__pointsmaxDbOverride) return g.__pointsmaxDbOverride
  if (!g.__pointsmaxDb) {
    const url = getDatabaseUrl()
    if (!url) throw new Error('DATABASE_URL is not set — database unavailable')
    const client = postgres(url, {
      max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '5', 10),
      // Neon's pooler runs in transaction mode, which does not support prepared statements.
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
