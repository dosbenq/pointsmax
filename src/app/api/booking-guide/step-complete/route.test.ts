// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { bookingGuideSessions, bookingGuideSteps } from '@/lib/db/schema'
import { inngest } from '@/lib/inngest/client'
import { createTestDb, seedUser, sessionFor, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { POST } from './route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))
vi.mock('@/lib/inngest/client', () => ({ inngest: { send: vi.fn() } }))
vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

let db: TestDb
let user: SeededUser

const complete = (body: unknown) => POST(new NextRequest('http://localhost/api/booking-guide/step-complete', {
  method: 'POST',
  body: JSON.stringify(body),
}))

async function seedSession(status = 'active') {
  const [session] = await db.insert(bookingGuideSessions).values({
    userId: user.userId, redemptionLabel: 'Transfer', status, currentStepIndex: 1, totalSteps: 2,
  }).returning({ id: bookingGuideSessions.id })
  await db.insert(bookingGuideSteps).values([
    { sessionId: session.id, stepIndex: 0, title: 'One', status: 'completed' },
    { sessionId: session.id, stepIndex: 1, title: 'Two', status: 'current' },
  ])
  return session.id
}

beforeEach(async () => {
  vi.clearAllMocks()
  process.env.INNGEST_EVENT_KEY = 'event-key'
  db = await createTestDb()
  setDbForTesting(db)
  user = await seedUser(db, 'pat')
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
})

afterAll(() => setDbForTesting(null))

describe('/api/booking-guide/step-complete', () => {
  it('requires a valid session id', async () => {
    const res = await complete({ session_id: 'bad-id' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'session_id is required and must be a valid UUID' })
  })

  it('sends a session-scoped completion event for the current step', async () => {
    const sessionId = await seedSession()
    vi.mocked(inngest.send).mockResolvedValue([{ id: 'evt-2' }] as never)

    const res = await complete({ session_id: sessionId, note: 'done' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, session_id: sessionId, event_ids: ['evt-2'] })
    expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
      name: 'booking.step_completed',
      data: expect.objectContaining({ session_id: sessionId, user_id: user.userId, step_index: 1, note: 'done' }),
    }))
  })

  it('rejects completed sessions and other users’ sessions', async () => {
    const finished = await seedSession('completed')
    expect((await complete({ session_id: finished })).status).toBe(409)

    const active = await seedSession()
    const other = await seedUser(db, 'other')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(other))
    expect((await complete({ session_id: active })).status).toBe(404)
    expect(inngest.send).not.toHaveBeenCalled()
  })
})
