// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { alertSubscriptions } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedUser, sessionFor, testId, type TestDb } from '@/test/utils/test-db'
import { POST } from './route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

let db: TestDb
const subscribe = (body: unknown) => POST(new NextRequest('https://pointsmax.com/api/alerts/subscribe', {
  method: 'POST',
  body: JSON.stringify(body),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [{ key: 'chase-ur' }, { key: 'amex-mr' }])
})

afterAll(() => setDbForTesting(null))

describe('POST /api/alerts/subscribe', () => {
  it('creates a guest subscription and refuses to overwrite it as a guest', async () => {
    expect((await subscribe({ email: 'Guest@Example.com', program_ids: [testId('chase-ur')] })).status).toBe(200)
    expect((await subscribe({ email: 'guest@example.com', program_ids: [testId('amex-mr')] })).status).toBe(409)

    const rows = await db.select().from(alertSubscriptions)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ email: 'guest@example.com', userId: null, programIds: [testId('chase-ur')] })
  })

  it('lets a signed-in user claim and update their own email subscription', async () => {
    await subscribe({ email: 'pat@example.com', program_ids: [testId('chase-ur')] })
    const user = await seedUser(db, 'pat')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))

    expect((await subscribe({ email: 'pat@example.com', program_ids: [testId('amex-mr')] })).status).toBe(200)
    const rows = await db.select().from(alertSubscriptions)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId: user.userId, programIds: [testId('amex-mr')] })
  })

  it('rejects a signed-in user subscribing a different email', async () => {
    const user = await seedUser(db, 'pat')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
    expect((await subscribe({ email: 'someone-else@example.com', program_ids: [testId('chase-ur')] })).status).toBe(403)
  })
})
