// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { flightWatches } from '@/lib/db/schema'
import { createTestDb, seedUser, sessionFor, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { GET, POST } from './route'
import { DELETE, PATCH } from './[id]/route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))

vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

let db: TestDb
let premium: SeededUser
let free: SeededUser

const watchBody = { origin: 'jfk', destination: 'cdg', cabin: 'business', start_date: '2026-11-01', end_date: '2026-11-05', max_points: 50000 }
const json = (body: unknown, method = 'POST') => new NextRequest('https://pointsmax.com/api/flight-watches', { method, body: JSON.stringify(body) })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
  premium = await seedUser(db, 'premium', { tier: 'premium' })
  free = await seedUser(db, 'free')
  const { resetSubscriptionTierCache } = await import('@/lib/subscription')
  resetSubscriptionTierCache()
})

afterAll(() => setDbForTesting(null))

describe('/api/flight-watches', () => {
  it('requires a session', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect((await GET(new NextRequest('https://pointsmax.com/api/flight-watches'))).status).toBe(401)
  })

  it('returns 403 on POST for free-tier users', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(free))
    const res = await POST(json(watchBody))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('PREMIUM_REQUIRED')
  })

  it('creates and lists watches for premium users', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(premium))
    const created = await POST(json(watchBody))
    expect(created.status).toBe(201)
    const { watch } = await created.json()
    expect(watch).toMatchObject({ origin: 'JFK', destination: 'CDG', max_points: 50000, is_active: true })

    const list = await (await GET(new NextRequest('https://pointsmax.com/api/flight-watches'))).json()
    expect(list.watches.map((w: { id: string }) => w.id)).toEqual([watch.id])
  })

  it('keeps GET available for authenticated users regardless of tier', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(free))
    const res = await GET(new NextRequest('https://pointsmax.com/api/flight-watches'))
    expect(res.status).toBe(200)
    expect((await res.json()).watches).toEqual([])
  })

  it('validates date ranges', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(premium))
    const res = await POST(json({ ...watchBody, end_date: '2027-03-01' }))
    expect(res.status).toBe(400)
  })
})

describe('/api/flight-watches/[id]', () => {
  async function seedWatch(owner: SeededUser) {
    const [row] = await db.insert(flightWatches).values({
      userId: owner.userId, origin: 'JFK', destination: 'LHR', cabin: 'business', startDate: '2026-11-01', endDate: '2026-11-05',
    }).returning({ id: flightWatches.id })
    return row.id
  }

  it('updates only the owner’s watch', async () => {
    const id = await seedWatch(premium)

    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(free))
    expect((await PATCH(json({ max_points: 1 }, 'PATCH'), params(id))).status).toBe(404)

    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(premium))
    const res = await PATCH(json({ max_points: 70000, is_active: false }, 'PATCH'), params(id))
    expect(res.status).toBe(200)
    expect((await res.json()).watch).toMatchObject({ max_points: 70000, is_active: false })
  })

  it('rejects an update that makes the date range invalid', async () => {
    const id = await seedWatch(premium)
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(premium))
    expect((await PATCH(json({ end_date: '2026-10-01' }, 'PATCH'), params(id))).status).toBe(400)
  })

  it('deletes only the owner’s watch', async () => {
    const id = await seedWatch(premium)

    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(free))
    await DELETE(json({}, 'DELETE'), params(id))
    expect(await db.select().from(flightWatches)).toHaveLength(1)

    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(premium))
    expect((await DELETE(json({}, 'DELETE'), params(id))).status).toBe(200)
    expect(await db.select().from(flightWatches)).toHaveLength(0)
  })
})
