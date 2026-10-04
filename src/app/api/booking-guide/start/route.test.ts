// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { bookingGuideSessions, bookingGuideSteps } from '@/lib/db/schema'
import { inngest } from '@/lib/inngest/client'
import { createTestDb, seedUser, sessionFor, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { GET, POST } from './route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/inngest/client', () => ({ inngest: { send: vi.fn() } }))
vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

let db: TestDb
let user: SeededUser

const start = (body: unknown) => POST(new NextRequest('http://localhost/api/booking-guide/start', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
}))

beforeEach(async () => {
  vi.clearAllMocks()
  process.env.INNGEST_EVENT_KEY = 'event-key'
  db = await createTestDb()
  setDbForTesting(db)
  user = await seedUser(db, 'pat')
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
})

afterAll(() => setDbForTesting(null))

describe('/api/booking-guide/start', () => {
  it('requires a session', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect((await start({ redemption_label: 'x' })).status).toBe(401)
  })

  it('creates a booking guide session and starts the workflow', async () => {
    vi.mocked(inngest.send).mockResolvedValue({ ids: ['evt-1'] } as never)

    const res = await start({ redemption_label: 'Transfer Chase to Hyatt' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.session).toMatchObject({ user_id: user.userId, redemption_label: 'Transfer Chase to Hyatt', status: 'pending' })
    expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
      name: 'booking.started',
      data: expect.objectContaining({ session_id: body.session.id, user_id: user.userId }),
    }))
  })

  it('marks the session failed when the workflow cannot be started', async () => {
    vi.mocked(inngest.send).mockRejectedValue(new Error('inngest down'))
    const res = await start({ redemption_label: 'Transfer Chase to Hyatt' })
    expect(res.status).toBe(500)
    const [session] = await db.select().from(bookingGuideSessions)
    expect(session).toMatchObject({ status: 'failed', lastError: 'inngest down' })
  })

  it('sanitizes and forwards structured booking context to the workflow event', async () => {
    vi.mocked(inngest.send).mockResolvedValue([{ id: 'evt-1' }] as never)
    const res = await start({
      redemption_label: 'Transfer Chase to Hyatt',
      booking_context: {
        origin: 'jfk',
        destination: 'cdg',
        cabin: 'business',
        passengers: 2,
        start_date: '2026-06-01',
        end_date: '2026-06-10',
        program_name: 'World of Hyatt',
        estimated_miles: 60000,
        points_needed_from_wallet: 60000,
        transfer_chain: 'Chase Ultimate Rewards → World of Hyatt',
        transfer_is_instant: true,
        has_real_availability: true,
        availability_date: '2026-06-02',
        deep_link_label: 'Hyatt',
        deep_link_url: 'https://www.hyatt.com/',
        balances: [
          { program_name: 'Chase Ultimate Rewards', balance: 80000 },
          { program_name: 'Invalid', balance: -1 },
        ],
      },
    })

    expect(res.status).toBe(200)
    expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        booking_context: expect.objectContaining({
          origin: 'JFK',
          destination: 'CDG',
          balances: [{ program_name: 'Chase Ultimate Rewards', balance: 80000 }],
        }),
      }),
    }))
  })

  it('returns a session with steps and current step, and hides other users’ sessions', async () => {
    const [session] = await db.insert(bookingGuideSessions).values({
      userId: user.userId, redemptionLabel: 'Transfer Chase to Hyatt', status: 'active', currentStepIndex: 1, totalSteps: 3,
    }).returning({ id: bookingGuideSessions.id })
    await db.insert(bookingGuideSteps).values([
      { sessionId: session.id, stepIndex: 0, title: 'Check award space', status: 'completed' },
      { sessionId: session.id, stepIndex: 1, title: 'Transfer points', status: 'current' },
      { sessionId: session.id, stepIndex: 2, title: 'Book', status: 'pending' },
    ])

    const res = await GET(new NextRequest(`http://localhost/api/booking-guide/start?session_id=${session.id}`))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.steps.map((s: { title: string }) => s.title)).toEqual(['Check award space', 'Transfer points', 'Book'])
    expect(body.current_step).toMatchObject({ step_index: 1, title: 'Transfer points' })

    const list = await (await GET(new NextRequest('http://localhost/api/booking-guide/start'))).json()
    expect(list.sessions).toHaveLength(1)

    const other = await seedUser(db, 'other')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(other))
    expect((await GET(new NextRequest(`http://localhost/api/booking-guide/start?session_id=${session.id}`))).status).toBe(404)
  })
})
