// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getCatalogProgramBySlug, getCatalogTransferPartners } from '@/lib/catalog'
import { setDbForTesting } from '@/lib/db/client'
import { alertSubscriptions, transferBonuses } from '@/lib/db/schema'
import { createTestDb, type TestDb } from '@/test/utils/test-db'

const createUnsubscribeTokenMock = vi.fn(() => 'token-123')
const resendSendMock = vi.fn()

vi.mock('@/lib/alerts-token', () => ({
  createUnsubscribeToken: createUnsubscribeTokenMock,
}))

vi.mock('@/lib/logger', () => ({
  getRequestId: () => 'req-test',
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('resend', () => {
  class ResendMock {
    emails = { send: resendSendMock }

    constructor(apiKey: string) {
      void apiKey
    }
  }

  return { Resend: ResendMock }
})

const { GET } = await import('./route')

function makeRequest(opts?: { authHeader?: string; secretParam?: string }) {
  const url = opts?.secretParam
    ? `https://pointsmax.com/api/cron/send-bonus-alerts?secret=${encodeURIComponent(opts.secretParam)}`
    : 'https://pointsmax.com/api/cron/send-bonus-alerts'
  return new NextRequest(url, {
    method: 'GET',
    headers: opts?.authHeader ? { authorization: opts.authHeader } : {},
  })
}

const CHASE_ID = getCatalogProgramBySlug('chase-ur')!.id
const FLYING_BLUE_ID = getCatalogProgramBySlug('flying-blue')!.id
const CHASE_TO_FLYING_BLUE = getCatalogTransferPartners()
  .find((row) => row.from_program_id === CHASE_ID && row.to_program_id === FLYING_BLUE_ID)!

let db: TestDb
const today = new Date().toISOString().slice(0, 10)
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

afterAll(() => setDbForTesting(null))

describe('GET /api/cron/send-bonus-alerts', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    db = await createTestDb()
    setDbForTesting(db)
    process.env.CRON_SECRET = 'cron-secret'
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM_EMAIL = 'alerts@pointsmax.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'
  })

  it('returns 401 when auth is missing or invalid', async () => {
    const unauthorized = await GET(makeRequest())
    const wrongSecret = await GET(makeRequest({ authHeader: 'Bearer nope' }))
    const queryParamOnly = await GET(makeRequest({ secretParam: 'cron-secret' }))

    expect(unauthorized.status).toBe(401)
    expect(wrongSecret.status).toBe(401)
    expect(queryParamOnly.status).toBe(401)
  })

  it('returns success with no work when there are no active bonuses', async () => {
    // Unverified, finished and already-alerted bonuses are not work.
    await db.insert(transferBonuses).values([
      { transferPartnerId: CHASE_TO_FLYING_BLUE.id, bonusPct: 30, startDate: today, endDate: inDays(5), isVerified: false },
      { transferPartnerId: CHASE_TO_FLYING_BLUE.id, bonusPct: 30, startDate: inDays(-9), endDate: inDays(-1), isVerified: true },
      { transferPartnerId: CHASE_TO_FLYING_BLUE.id, bonusPct: 30, startDate: today, endDate: inDays(5), isVerified: true, alertedAt: new Date().toISOString() },
    ])

    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, bonuses_processed: 0, emails_sent: 0 })
    expect(resendSendMock).not.toHaveBeenCalled()
  })

  it('sends bonus emails and marks bonus as alerted', async () => {
    const [bonus] = await db.insert(transferBonuses).values({
      transferPartnerId: CHASE_TO_FLYING_BLUE.id, bonusPct: 25, startDate: inDays(-1), endDate: inDays(20), isVerified: true,
    }).returning()
    await db.insert(alertSubscriptions).values([
      { email: 'a@example.com', programIds: [CHASE_ID] },
      { email: 'b@example.com', programIds: [CHASE_ID, FLYING_BLUE_ID] },
      { email: 'c@example.com', programIds: [FLYING_BLUE_ID] },
      { email: 'd@example.com', programIds: [CHASE_ID], isActive: false },
    ])

    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.bonuses_processed).toBe(1)
    expect(body.emails_sent).toBe(2)
    expect(body.failed_bonus_ids).toEqual([])
    expect(resendSendMock).toHaveBeenCalledTimes(2)
    expect(resendSendMock.mock.calls.map(([message]) => message.to).sort()).toEqual(['a@example.com', 'b@example.com'])
    const [stored] = await db.select().from(transferBonuses)
    expect(stored.id).toBe(bonus.id)
    expect(stored.alertedAt).not.toBeNull()
    expect(resendSendMock).toHaveBeenCalledWith(expect.objectContaining({
      subject: '+25% Transfer Bonus: Chase Ultimate Rewards → Air France/KLM Flying Blue',
    }))
  })
})
