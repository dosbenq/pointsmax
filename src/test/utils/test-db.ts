// In-memory Postgres (PGlite) with the app's real migrations applied.
// Usage in a test file that needs the database:
//
//   // @vitest-environment node
//   const db = await createTestDb()   // fresh schema
//   setDbForTesting(db)                // route getDb() to it
//
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/lib/db/schema'
import type { Database } from '@/lib/db/client'
import { applyMigrations } from '@/lib/db/migrate'

export type TestDb = Database & { $client: PGlite }

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite()
  const db = drizzle(client, { schema }) as unknown as TestDb
  await applyMigrations(db)
  return db
}
