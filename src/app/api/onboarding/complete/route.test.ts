// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { authUser, userBalances, userPreferences } from '@/lib/db/schema'
import { inngest } from '@/lib/inngest/client'
import { createTestDb, seedPrograms, seedUser, sessionFor, testId, type TestDb } from '@/test/utils/test-db'
import { POST } from './route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/inngest/client', () => ({ inngest: { send: vi.fn() } }))

let db: TestDb
const post = (body: unknown) => POST(new NextRequest('https://pointsmax.com/api/onboarding/complete', {
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

describe('POST /api/onboarding/complete', () => {
  it('requires a session', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect((await post({})).status).toBe(401)
  })

  it('saves the home airport and starting balances, then emits the onboarding event', async () => {
    const user = await seedUser(db, 'pat')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))

    const res = await post({
      region: 'us',
      home_airport: 'jfk',
      balances: [
        { program_slug: 'chase-ur', balance: 80000 },
        { program_slug: 'amex-mr', balance: '45,000' },
        { program_slug: 'not-a-program', balance: 10 },
      ],
    })
    expect(res.status).toBe(200)

    const [prefs] = await db.select().from(userPreferences)
    expect(prefs).toMatchObject({ userId: user.userId, homeAirport: 'JFK' })
    const balances = await db.select().from(userBalances)
    expect(balances.map((b) => [b.programId, b.balance])).toEqual([[testId('chase-ur'), 80000]])
    expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
      name: 'user.onboarding_completed',
      data: { user_id: user.userId, region: 'us', home_airport: 'JFK' },
    }))
  })

  it('creates the profile if the sign-up hook never did', async () => {
    const user = await seedUser(db, 'pat')
    vi.mocked(getSessionUser).mockResolvedValue({ ...sessionFor(user), id: testId('auth:fresh'), email: 'fresh@example.com' })
    await db.insert(authUser).values({ id: testId('auth:fresh'), name: 'fresh', email: 'fresh@example.com' })

    expect((await post({ home_airport: 'BOM', region: 'in' })).status).toBe(200)
    const prefs = await db.select().from(userPreferences)
    expect(prefs).toHaveLength(1)
    expect(prefs[0].homeAirport).toBe('BOM')
  })
})
