// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getCatalogCards, getCatalogProgramBySlug } from '@/lib/catalog'
import { setDbForTesting } from '@/lib/db/client'
import { affiliateClicks } from '@/lib/db/schema'
import { createTestDb, seedUser, sessionFor, type TestDb } from '@/test/utils/test-db'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))
vi.mock('@/lib/logger', () => ({
  getRequestId: () => 'test-request-id',
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

const { POST } = await import('./route')

// Cards are catalog data; use a real card that has an apply link.
const APPLY_CARD = getCatalogCards().find((card) => typeof card.apply_url === 'string' && card.apply_url.startsWith('https://'))!

let db: TestDb

function click(body: Record<string, unknown>) {
  return POST(new NextRequest('http://localhost/api/analytics/affiliate-click', { method: 'POST', body: JSON.stringify(body) }))
}

beforeEach(async () => {
  vi.mocked(getSessionUser).mockReset().mockResolvedValue(null)
  db = await createTestDb()
  setDbForTesting(db)
})

afterAll(() => setDbForTesting(null))

describe('POST /api/analytics/affiliate-click', () => {
  it('rejects an unknown card id with 400', async () => {
    const res = await click({ card_id: 'invalid-id' })
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toBe('Unknown card_id')
  })

  it('records the click with its attribution fields', async () => {
    const programId = getCatalogProgramBySlug('chase-ur')!.id
    const res = await click({
      card_id: APPLY_CARD.id,
      source_page: 'card-recommender',
      rank: 2,
      region: 'US',
      recommendation_mode: 'next_best_card',
      program_id: programId,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, tracked: true, redirect_url: APPLY_CARD.apply_url })
    expect(await db.select().from(affiliateClicks)).toEqual([
      expect.objectContaining({
        cardId: APPLY_CARD.id,
        userId: null,
        sourcePage: 'card-recommender',
        rank: 2,
        region: 'us',
        recommendationMode: 'next_best_card',
        programId,
      }),
    ])
  })

  it('attributes the click to the signed-in user and drops a malformed program id', async () => {
    const pat = await seedUser(db, 'pat')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(pat))

    await click({ card_id: APPLY_CARD.id, program_id: 'not-a-uuid' })

    expect(await db.select().from(affiliateClicks)).toEqual([
      expect.objectContaining({ userId: pat.userId, programId: null }),
    ])
  })

  it('still returns the apply link when the click cannot be stored', async () => {
    setDbForTesting(null) // no database configured in tests → every insert fails

    const res = await click({ card_id: APPLY_CARD.id })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, tracked: false, redirect_url: APPLY_CARD.apply_url })
  })
})
