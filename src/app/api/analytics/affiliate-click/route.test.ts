// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { affiliateClicks, cards, creators } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedUser, sessionFor, testId, type TestDb } from '@/test/utils/test-db'
import { GET, POST } from './route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

let db: TestDb
const cardId = testId('sapphire')

function post(body: unknown, cookie?: string) {
  return POST(new NextRequest('https://pointsmax.com/api/analytics/affiliate-click', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: cookie ? { cookie } : {},
  }))
}

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [{ key: 'chase-ur' }])
  await db.insert(cards).values({
    id: cardId, name: 'Sapphire', issuer: 'Chase', programId: testId('chase-ur'), applyUrl: 'https://creditcards.chase.com/sapphire',
  })
})

afterAll(() => setDbForTesting(null))

describe('/api/analytics/affiliate-click', () => {
  it('rejects unknown or malformed card ids with 400', async () => {
    expect((await post({ card_id: 'not-a-uuid' })).status).toBe(400)
    expect((await post({ card_id: testId('missing') })).status).toBe(400)
    expect((await post({})).status).toBe(400)
  })

  it('records the click with attribution fields, user and creator', async () => {
    const user = await seedUser(db, 'pat')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
    await db.insert(creators).values({ slug: 'greatmiles', name: 'Great Miles', platform: 'youtube' })

    const res = await post({
      card_id: cardId,
      program_id: testId('chase-ur'),
      source_page: 'card-recommender',
      rank: '2',
      region: 'US',
      recommendation_mode: 'wallet',
    }, 'pm_creator_ref=greatmiles')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, tracked: true, redirect_url: 'https://creditcards.chase.com/sapphire' })
    const [click] = await db.select().from(affiliateClicks)
    expect(click).toMatchObject({
      cardId,
      userId: user.userId,
      sourcePage: 'card-recommender',
      creatorSlug: 'greatmiles',
      rank: 2,
      region: 'us',
      recommendationMode: 'wallet',
      programId: testId('chase-ur'),
    })
  })

  it('ignores unknown creator referrals', async () => {
    await post({ card_id: cardId }, 'pm_creator_ref=nobody')
    const [click] = await db.select().from(affiliateClicks)
    expect(click.creatorSlug).toBeNull()
  })

  it('returns redirect_url even when tracking insert fails', async () => {
    await db.execute(sql`drop table affiliate_clicks`)
    const res = await post({ card_id: cardId })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, tracked: false, redirect_url: 'https://creditcards.chase.com/sapphire' })
  })

  it('redirects on GET', async () => {
    const res = await GET(new NextRequest(`https://pointsmax.com/api/analytics/affiliate-click?card_id=${cardId}&source_page=cards`))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://creditcards.chase.com/sapphire')
  })
})
