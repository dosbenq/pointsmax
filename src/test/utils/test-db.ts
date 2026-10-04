// In-memory Postgres (PGlite) with the real migrations applied.
// Usage in a test file that needs the database:
//
//   // @vitest-environment node
//   const db = await createTestDb()   // fresh schema
//   setDbForTesting(db)                // route getDb() to it
//
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/lib/db/schema'
import type { Database } from '@/lib/db/client'

export type TestDb = Database & { $client: PGlite }

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite({ extensions: { vector } })
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../db/migrations') })
  return db as unknown as TestDb
}
