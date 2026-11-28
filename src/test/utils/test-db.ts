// In-memory Postgres (PGlite) with the app's real migrations applied.
// Usage in a test file that needs the database:
//
//   // @vitest-environment node
//   const db = await createTestDb()   // fresh schema
//   setDbForTesting(db)                // route getDb() to it
//
import { createHash } from 'node:crypto'
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

/** Deterministic UUID for a readable test key, e.g. testId('pat'). */
export function testId(key: string): string {
  const hex = createHash('sha1').update(key).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export type SeededUser = { authId: string; userId: string; email: string }

/** Create a Better Auth user plus the linked app profile row. */
export async function seedUser(
  db: TestDb,
  key: string,
  opts: { tier?: 'free' | 'premium'; email?: string } = {},
): Promise<SeededUser> {
  const email = opts.email ?? `${key}@example.com`
  const authId = testId(`auth:${key}`)
  const userId = testId(`user:${key}`)
  await db.insert(schema.authUser).values({ id: authId, name: key, email, emailVerified: true })
  await db.insert(schema.users).values({ id: userId, authId, email, tier: opts.tier ?? 'free' })
  return { authId, userId, email }
}

/** The SessionUser getSessionUser() would return for a seeded user. */
export function sessionFor(user: SeededUser) {
  return {
    id: user.authId,
    email: user.email,
    name: null,
    image: null,
    emailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}
