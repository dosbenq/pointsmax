// In-memory Postgres (PGlite) with the real migrations applied.
// Usage in a test file that needs the database:
//
//   // @vitest-environment node
//   const db = await createTestDb()   // fresh schema
//   setDbForTesting(db)                // route getDb() to it
//
import { createHash } from 'node:crypto'
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

/** Deterministic UUID for a readable test key, e.g. testId('chase-ur'). */
export function testId(key: string): string {
  const hex = createHash('sha1').update(key).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

type ProgramSeed = {
  key: string
  name?: string
  type?: 'transferable_points' | 'airline_miles' | 'hotel_points' | 'cashback'
  geography?: string
  cpp?: number
  effectiveDate?: string
}

/** Insert programmes (and their valuations) keyed by readable ids. */
export async function seedPrograms(db: TestDb, seeds: ProgramSeed[]): Promise<void> {
  for (const s of seeds) {
    await db.insert(schema.programs).values({
      id: testId(s.key),
      name: s.name ?? s.key,
      shortName: s.name ?? s.key,
      slug: s.key,
      type: s.type ?? 'transferable_points',
      geography: s.geography ?? 'US',
    })
    if (s.cpp != null) {
      await db.insert(schema.valuations).values({
        programId: testId(s.key),
        cppCents: s.cpp,
        source: 'manual',
        effectiveDate: s.effectiveDate ?? '2026-04-09',
      })
    }
  }
}

export async function seedTransfer(
  db: TestDb,
  from: string,
  to: string,
  opts: { ratioFrom?: number; ratioTo?: number; maxHrs?: number; instant?: boolean } = {},
): Promise<string> {
  const id = testId(`tp:${from}->${to}`)
  await db.insert(schema.transferPartners).values({
    id,
    fromProgramId: testId(from),
    toProgramId: testId(to),
    ratioFrom: opts.ratioFrom ?? 1,
    ratioTo: opts.ratioTo ?? 1,
    transferTimeMaxHrs: opts.maxHrs ?? 0,
    isInstant: opts.instant ?? true,
  })
  return id
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
