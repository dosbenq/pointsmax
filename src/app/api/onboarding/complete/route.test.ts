// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getCatalogProgramBySlug } from '@/lib/catalog'
import { setDbForTesting } from '@/lib/db/client'
import { userBalances, userPreferences, users } from '@/lib/db/schema'
import { createTestDb, seedUser, sessionFor, type SeededUser, type TestDb } from '@/test/utils/test-db'

const { captureServerEventMock } = vi.hoisted(() => ({ captureServerEventMock: vi.fn() }))

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/posthog-server', () => ({ captureServerEvent: captureServerEventMock }))

const { POST } = await import('./route')

let db: TestDb
let pat: SeededUser

function post(body: unknown) {
  return POST(new NextRequest('http://localhost/api/onboarding/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
  pat = await seedUser(db, 'pat')
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(pat))
})

afterAll(() => setDbForTesting(null))

describe('POST /api/onboarding/complete', () => {
  it('requires a signed-in user', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect((await post({ region: 'us' })).status).toBe(401)
    expect(captureServerEventMock).not.toHaveBeenCalled()
  })

  it('saves the home airport and starting balances for the signed-in user', async () => {
    const res = await post({
      region: 'in',
      home_airport: ' del ',
      balances: [
        { program_slug: 'hdfc-millennia', balance: '25000' },
        { program_slug: 'no-such-program', balance: 1000 },
        { program_slug: 'chase-ur', balance: -5 },
      ],
    })

    expect(res.status).toBe(200)
    expect(await db.select({ userId: userPreferences.userId, homeAirport: userPreferences.homeAirport }).from(userPreferences))
      .toEqual([{ userId: pat.userId, homeAirport: 'DEL' }])
    expect(await db.select({ programId: userBalances.programId, balance: userBalances.balance }).from(userBalances))
      .toEqual([{ programId: getCatalogProgramBySlug('hdfc-millennia')!.id, balance: 25000 }])
    expect(captureServerEventMock).toHaveBeenCalledWith(expect.objectContaining({
      distinctId: pat.userId,
      event: 'onboarding_completed',
      properties: { region: 'in', home_airport: 'DEL', balances_saved: 1 },
    }))
  })

  it('creates the profile on the fly for a sign-in that has none yet', async () => {
    await db.delete(users)
    const res = await post({ region: 'us', home_airport: 'SFO' })

    expect(res.status).toBe(200)
    const [profile] = await db.select().from(users)
    expect(profile).toMatchObject({ authId: pat.authId, email: pat.email })
  })
})
