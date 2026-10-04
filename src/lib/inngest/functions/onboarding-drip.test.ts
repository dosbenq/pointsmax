// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onboardingEmailLog, userBalances, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createTestDb, seedPrograms, seedUser, testId, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { loadDripCandidates, sendOnboardingDrip } from './onboarding-drip'

let db: TestDb
let pat: SeededUser
const send = vi.fn(async () => ({}))
const resend = { emails: { send } }

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const kindsFor = async (userId: string) =>
  (await db.select({ kind: onboardingEmailLog.emailKind }).from(onboardingEmailLog).where(eq(onboardingEmailLog.userId, userId)))
    .map((r) => r.kind)
    .sort()

async function run() {
  return sendOnboardingDrip(db, resend, 'hi@pointsmax.com', await loadDripCandidates(db))
}

beforeEach(async () => {
  send.mockClear()
  db = await createTestDb()
  pat = await seedUser(db, 'pat')
})

describe('onboarding drip', () => {
  it('sends the welcome email once', async () => {
    expect(await run()).toBe(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: pat.email, subject: expect.stringContaining('Welcome') }))
    expect(await kindsFor(pat.userId)).toEqual(['welcome'])

    expect(await run()).toBe(0)
  })

  it('skips users already handled by the event-driven onboarding flow', async () => {
    await db.insert(onboardingEmailLog).values({ userId: pat.userId, email: pat.email, emailKind: 'event_welcome' })

    expect(await run()).toBe(0)
    expect(send).not.toHaveBeenCalled()
  })

  it('nudges inactive users on day 2 but not users who added balances', async () => {
    await db.update(users).set({ createdAt: daysAgo(3) }).where(eq(users.id, pat.userId))
    await db.insert(onboardingEmailLog).values({ userId: pat.userId, email: pat.email, emailKind: 'welcome' })
    const sam = await seedUser(db, 'sam')
    await db.update(users).set({ createdAt: daysAgo(3) }).where(eq(users.id, sam.userId))
    await db.insert(onboardingEmailLog).values({ userId: sam.userId, email: sam.email, emailKind: 'welcome' })
    await seedPrograms(db, [{ key: 'chase-ur' }])
    await db.insert(userBalances).values({ userId: sam.userId, programId: testId('chase-ur'), balance: 50_000 })

    expect(await run()).toBe(1)
    expect(await kindsFor(pat.userId)).toEqual(['day2', 'welcome'])
    expect(await kindsFor(sam.userId)).toEqual(['welcome'])
  })

  it('ignores users older than eight days', async () => {
    await db.update(users).set({ createdAt: daysAgo(10) }).where(eq(users.id, pat.userId))
    expect(await run()).toBe(0)
  })
})
