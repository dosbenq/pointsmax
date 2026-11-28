// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { createTestDb, seedUser, sessionFor, type SeededUser, type TestDb } from '@/test/utils/test-db'

const { captureServerEventMock } = vi.hoisted(() => ({ captureServerEventMock: vi.fn() }))

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/posthog-server', () => ({ captureServerEvent: captureServerEventMock }))

const { GET } = await import('./route')

const ORIGIN = 'https://pointsmax.test'
let db: TestDb
let pat: SeededUser

const land = async (query: string) => (await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`))).headers.get('location')

const savedAuthUrl = process.env.BETTER_AUTH_URL

beforeEach(async () => {
  vi.clearAllMocks()
  process.env.BETTER_AUTH_URL = ORIGIN
  db = await createTestDb()
  setDbForTesting(db)
  pat = await seedUser(db, 'pat')
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(pat))
})

afterAll(() => {
  setDbForTesting(null)
  if (savedAuthUrl === undefined) delete process.env.BETTER_AUTH_URL
  else process.env.BETTER_AUTH_URL = savedAuthUrl
})

describe('GET /auth/callback', () => {
  it('sends people straight to where they were going', async () => {
    expect(await land('?next=/in/profile')).toBe(`${ORIGIN}/in/profile`)
    expect(await land('')).toBe(`${ORIGIN}/us`)
  })

  it('ignores next paths that could leave the site', async () => {
    for (const next of ['//evil.example', '/%2F%2Fevil.example', 'https://evil.example/x']) {
      expect(await land(`?next=${encodeURIComponent(next)}`)).toBe(`${ORIGIN}/us`)
    }
  })

  it('reports a failed sign-in', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect(await land('')).toBe(`${ORIGIN}/us?auth_error=1`)
  })

  it('counts a brand-new profile as a sign-up, once', async () => {
    await land('?next=/us')
    expect(captureServerEventMock).toHaveBeenCalledWith(expect.objectContaining({
      distinctId: pat.userId,
      event: 'user_signed_up',
      dedupeKey: `signup:${pat.userId}`,
    }))
  })
})
