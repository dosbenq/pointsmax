// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDbForTesting } from '@/lib/db/client'
import { affiliateClicks, cards, creators } from '@/lib/db/schema'
import { createTestDb, seedPrograms, testId, type TestDb } from '@/test/utils/test-db'

const requireAdminMock = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: requireAdminMock,
}))

const { GET } = await import('./route')

let db: TestDb

afterAll(() => setDbForTesting(null))

describe('GET /api/admin/affiliate-clicks', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({ error: null, adminEmail: 'admin@test.com' })
    db = await createTestDb()
    setDbForTesting(db)
    await seedPrograms(db, [{ key: 'chase-ur' }])
    await db.insert(cards).values([
      { id: testId('card-1'), name: 'Card One', issuer: 'Chase', programId: testId('chase-ur') },
      { id: testId('card-2'), name: 'Card Two', issuer: 'Chase', programId: testId('chase-ur') },
    ])
    await db.insert(creators).values({ slug: 'creator-1', name: 'Creator One' })
  })

  it('returns grouped metrics for the last 30 days', async () => {
    const old = new Date(Date.now() - 45 * 86_400_000).toISOString()
    await db.insert(affiliateClicks).values([
      { cardId: testId('card-1'), sourcePage: 'recommender', region: 'us', rank: 1 },
      { cardId: testId('card-1'), sourcePage: 'recommender', region: 'us', rank: 2 },
      { cardId: testId('card-2'), sourcePage: 'card-page', creatorSlug: 'creator-1', region: 'in' },
      { cardId: testId('card-2'), sourcePage: 'card-page', region: 'in', createdAt: old },
    ])

    const res = await GET(new Request('http://localhost/api/admin/affiliate-clicks'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.window_days).toBe(30)
    expect(body.rows).toEqual([
      { card_id: testId('card-1'), card_name: 'Card One', source_page: 'recommender', creator_slug: null, region: 'us', clicks: 2 },
      { card_id: testId('card-2'), card_name: 'Card Two', source_page: 'card-page', creator_slug: 'creator-1', region: 'in', clicks: 1 },
    ])
  })
})
