// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { createTestDb, seedUser, sessionFor, type TestDb } from '@/test/utils/test-db'
import { canUseFeature, getUserTier, resetSubscriptionTierCache } from './subscription'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))

let db: TestDb

describe('subscription helpers', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    resetSubscriptionTierCache()
    db = await createTestDb()
    setDbForTesting(db)
  })

  afterAll(() => setDbForTesting(null))

  it('returns free when no session exists', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    await expect(getUserTier()).resolves.toBe('free')
  })

  it('returns the signed-in user tier', async () => {
    const user = await seedUser(db, 'pat', { tier: 'premium' })
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
    await expect(getUserTier()).resolves.toBe('premium')
  })

  it('returns the stored tier for a known internal user id', async () => {
    const user = await seedUser(db, 'sam', { tier: 'premium' })
    await expect(getUserTier(user.userId)).resolves.toBe('premium')
  })

  it('returns free when the lookup throws', async () => {
    vi.mocked(getSessionUser).mockRejectedValue(new Error('boom'))
    await expect(getUserTier()).resolves.toBe('free')
  })

  it('allows only premium users to access gated features', () => {
    expect(canUseFeature('free', 'live_award_search')).toBe(false)
    expect(canUseFeature('free', 'flight_watches')).toBe(false)
    expect(canUseFeature('free', 'connector_sync')).toBe(false)
    expect(canUseFeature('premium', 'live_award_search')).toBe(true)
    expect(canUseFeature('premium', 'flight_watches')).toBe(true)
    expect(canUseFeature('premium', 'connector_sync')).toBe(true)
  })

  it('caches tier lookups for a known internal user id', async () => {
    const user = await seedUser(db, 'kim', { tier: 'premium' })
    await expect(getUserTier(user.userId)).resolves.toBe('premium')
    await db.execute(sql`update users set tier = 'free'`)
    await expect(getUserTier(user.userId)).resolves.toBe('premium')
    resetSubscriptionTierCache()
    await expect(getUserTier(user.userId)).resolves.toBe('free')
  })
})
