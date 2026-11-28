// ============================================================
// Applies db/migrations (embedded in migrations.generated.ts) from inside
// the app, so a deploy never needs a separate migration step.
//
// Everything runs in one transaction holding a transaction-level advisory
// lock: concurrent cold starts queue behind each other, and session-level
// locks are not reliable through Neon's transaction-mode pooler.
// ============================================================

import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { Database } from './client'
import { MIGRATIONS, type EmbeddedMigration } from './migrations.generated'

// Kept out of schema.ts so drizzle-kit never generates it: it must exist
// before the first migration runs.
const appSchemaMigrations = pgTable('app_schema_migrations', {
  tag: text().primaryKey().notNull(),
  hash: text().notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

const MIGRATION_LOCK_KEY = 74_200_001

export type MigrationResult = { applied: string[]; total: number }

export async function applyMigrations(
  db: Database,
  migrations: EmbeddedMigration[] = MIGRATIONS,
): Promise<MigrationResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`)
    await tx.execute(sql`
      create table if not exists app_schema_migrations (
        tag text primary key,
        hash text not null,
        applied_at timestamptz not null default now()
      )
    `)

    const done = new Map(
      (await tx.select().from(appSchemaMigrations)).map((row) => [row.tag, row.hash]),
    )
    const applied: string[] = []

    for (const migration of migrations) {
      const appliedHash = done.get(migration.tag)
      if (appliedHash) {
        if (appliedHash !== migration.hash) {
          throw new Error(`Migration ${migration.tag} was edited after it was applied; add a new migration instead`)
        }
        continue
      }
      for (const statement of migration.statements) {
        await tx.execute(sql.raw(statement))
      }
      await tx.insert(appSchemaMigrations).values({ tag: migration.tag, hash: migration.hash })
      applied.push(migration.tag)
    }

    return { applied, total: migrations.length }
  })
}

type SchemaState = { promise: Promise<MigrationResult>; failedAt?: number }
const RETRY_AFTER_FAILURE_MS = 30_000

/**
 * Apply pending migrations once per server instance. A failure is retried on
 * a later call (after a short pause) rather than cached forever.
 */
export function ensureSchema(getDatabase: () => Database): Promise<MigrationResult> {
  const g = globalThis as typeof globalThis & { __pointsmaxSchema?: SchemaState }
  const state = g.__pointsmaxSchema
  if (state && (state.failedAt === undefined || Date.now() - state.failedAt < RETRY_AFTER_FAILURE_MS)) {
    return state.promise
  }
  const next: SchemaState = { promise: Promise.resolve().then(() => applyMigrations(getDatabase())) }
  next.promise.catch(() => {
    next.failedAt = Date.now()
  })
  g.__pointsmaxSchema = next
  return next.promise
}

/** Tests only. */
export function resetSchemaStateForTesting(): void {
  const g = globalThis as typeof globalThis & { __pointsmaxSchema?: SchemaState }
  delete g.__pointsmaxSchema
}
