// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { authAccount, authSession, subscriptionEvents, userBalances, userPreferences } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedUser, sessionFor, testId, type TestDb } from '@/test/utils/test-db'
import { DELETE } from './route'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))

let db: TestDb
const request = () => new NextRequest('https://pointsmax.com/api/user/account', { method: 'DELETE' })
const count = async (table: string) =>
  (await db.execute<{ n: number }>(sql.raw(`select count(*)::int as n from ${table}`))).rows[0].n

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
})

afterAll(() => setDbForTesting(null))

describe('DELETE /api/user/account', () => {
  it('requires a session', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect((await DELETE(request())).status).toBe(401)
  })

  it('removes a premium user with billing history, keeping the anonymised events', async () => {
    await seedPrograms(db, [{ key: 'chase-ur' }])
    const user = await seedUser(db, 'payer', { tier: 'premium' })
    const other = await seedUser(db, 'other')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))

    await db.insert(userBalances).values({ userId: user.userId, programId: testId('chase-ur'), balance: 1000 })
    await db.insert(userPreferences).values({ userId: user.userId, homeAirport: 'JFK' })
    await db.insert(subscriptionEvents).values({ userId: user.userId, eventType: 'checkout.session.completed' })
    await db.insert(authSession).values({ userId: user.authId, token: 't', expiresAt: new Date('2030-01-01T00:00:00Z') })
    await db.insert(authAccount).values({ userId: user.authId, accountId: 'google-sub', providerId: 'google' })

    const res = await DELETE(request())
    expect(res.status).toBe(200)

    expect(await count('users')).toBe(1)
    expect(await count('auth_user')).toBe(1)
    expect(await count('auth_session')).toBe(0)
    expect(await count('auth_account')).toBe(0)
    expect(await count('user_balances')).toBe(0)
    expect(await count('user_preferences')).toBe(0)
    const events = await db.execute<{ user_id: string | null }>(sql`select user_id from subscription_events`)
    expect(events.rows).toEqual([{ user_id: null }])
    // The other account is untouched.
    const remaining = await db.execute<{ id: string }>(sql`select id from users`)
    expect(remaining.rows).toEqual([{ id: other.userId }])
  })

  it('rolls everything back if any step fails', async () => {
    const user = await seedUser(db, 'kim')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
    await db.execute(sql`drop table shared_trips cascade`)

    const res = await DELETE(request())
    expect(res.status).toBe(500)
    expect(await count('users')).toBe(1)
    expect(await count('auth_user')).toBe(1)
  })
})
