// @vitest-environment node
// Runs Better Auth itself against the real schema (PGlite) to prove the
// auth_* tables, UUID ids and the profile hook work together. Email+password
// is enabled only here because Google OAuth cannot run in tests.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDbForTesting } from '@/lib/db/client'
import { authSession, authUser, users } from '@/lib/db/schema'
import { createTestDb, type TestDb } from '@/test/utils/test-db'
import { createAuth } from './auth'

let db: TestDb
let auth: ReturnType<typeof createAuth>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
  auth = createAuth(db, {
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-test-secret-test-secret-1234',
    emailAndPassword: { enabled: true },
    plugins: [],
  })
})

afterAll(() => setDbForTesting(null))

async function signUp(email: string) {
  const res = await auth.api.signUpEmail({
    body: { email, password: 'correct-horse-battery', name: 'Pat' },
    asResponse: true,
  })
  expect(res.status).toBe(200)
  return res.headers.get('set-cookie') ?? ''
}

describe('Better Auth on the PointsMax schema', () => {
  it('creates a UUID auth user, a linked profile row and a session', async () => {
    const setCookie = await signUp('pat@example.com')

    const [authRow] = await db.select().from(authUser)
    expect(authRow.id).toMatch(UUID_RE)
    const [profile] = await db.select().from(users).where(eq(users.authId, authRow.id))
    expect(profile).toMatchObject({ email: 'pat@example.com', tier: 'free' })
    expect(await db.select().from(authSession)).toHaveLength(1)

    const cookie = setCookie.split(/,(?=\s*\w+=)/).map((c) => c.split(';')[0].trim()).join('; ')
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.email).toBe('pat@example.com')
  })

  it('links an existing profile with the same email instead of duplicating it', async () => {
    await db.insert(users).values({ email: 'early@example.com', tier: 'premium' })
    await signUp('early@example.com')

    const rows = await db.select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0].tier).toBe('premium')
    expect(rows[0].authId).toMatch(UUID_RE)
  })

  it('removes sessions when the auth user is deleted', async () => {
    await signUp('gone@example.com')
    await db.delete(authUser)
    expect(await db.select().from(authSession)).toHaveLength(0)
  })
})
