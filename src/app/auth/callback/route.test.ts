// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { userPreferences } from '@/lib/db/schema'
import { createTestDb, seedUser, sessionFor, type SeededUser, type TestDb } from '@/test/utils/test-db'

const { captureServerEventMock } = vi.hoisted(() => ({ captureServerEventMock: vi.fn() }))

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/posthog-server', () => ({ captureServerEvent: captureServerEventMock }))

const { GET } = await import('./route')

const ORIGIN = 'https://pointsmax.test' // NEXT_PUBLIC_APP_URL in vitest.setup.ts
let db: TestDb
let pat: SeededUser

const land = async (query: string) => (await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`))).headers.get('location')

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
  pat = await seedUser(db, 'pat')
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(pat))
})

afterAll(() => setDbForTesting(null))

describe('GET /auth/callback', () => {
  it('sends people without a home airport to onboarding in their region', async () => {
    expect(await land('?next=/in/calculator')).toBe(`${ORIGIN}/in/onboarding`)
  })

  it('sends people who finished onboarding to where they were going', async () => {
    await db.insert(userPreferences).values({ userId: pat.userId, homeAirport: 'SFO' })
    expect(await land('?next=/us/award-search')).toBe(`${ORIGIN}/us/award-search`)
  })

  it('ignores next paths that could leave the site', async () => {
    await db.insert(userPreferences).values({ userId: pat.userId, homeAirport: 'SFO' })
    for (const next of ['//evil.example', '/%2F%2Fevil.example', 'https://evil.example/x']) {
      expect(await land(`?next=${encodeURIComponent(next)}`)).toBe(`${ORIGIN}/us/calculator`)
    }
  })

  it('reports a failed sign-in', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect(await land('')).toBe(`${ORIGIN}/us/calculator?auth_error=1`)
  })

  it('counts a brand-new profile as a sign-up, once', async () => {
    await land('?next=/us/calculator')
    expect(captureServerEventMock).toHaveBeenCalledWith(expect.objectContaining({
      distinctId: pat.userId,
      event: 'user_signed_up',
      dedupeKey: `signup:${pat.userId}`,
    }))
  })
})
