// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { setDbForTesting } from '@/lib/db/client'
import { alertSubscriptions, transferBonuses } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedTransfer, testId, type TestDb } from '@/test/utils/test-db'

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

let db: TestDb
let partnerId: string

const today = new Date().toISOString().split('T')[0]
const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0]

async function seedBonus(id: string, opts: { verified?: boolean; bonusPct?: number } = {}) {
  await db.insert(transferBonuses).values({
    id: testId(id),
    transferPartnerId: partnerId,
    bonusPct: opts.bonusPct ?? 25,
    startDate: today,
    endDate: nextMonth,
    verified: opts.verified ?? true,
  })
}

const alertedAt = async (id: string) =>
  (await db.select({ alertedAt: transferBonuses.alertedAt }).from(transferBonuses).where(eq(transferBonuses.id, testId(id))))[0]?.alertedAt

afterAll(() => setDbForTesting(null))

describe('GET /api/cron/send-bonus-alerts', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM_EMAIL = 'alerts@pointsmax.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'
    db = await createTestDb()
    setDbForTesting(db)
    await seedPrograms(db, [
      { key: 'chase-ur', name: 'Chase Ultimate Rewards' },
      { key: 'flying-blue', name: 'Flying Blue', type: 'airline_miles' },
    ])
    partnerId = await seedTransfer(db, 'chase-ur', 'flying-blue')
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
    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, bonuses_processed: 0, emails_sent: 0 })
    expect(resendSendMock).not.toHaveBeenCalled()
  })

  it('emails each matching active subscriber and marks the bonus as alerted', async () => {
    await seedBonus('bonus-1')
    await db.insert(alertSubscriptions).values([
      { email: 'a@example.com', programIds: [testId('chase-ur')] },
      { email: 'b@example.com', programIds: [testId('chase-ur'), testId('flying-blue')] },
      { email: 'inactive@example.com', programIds: [testId('chase-ur')], isActive: false },
      { email: 'other@example.com', programIds: [testId('flying-blue')] },
    ])

    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, bonuses_processed: 1, emails_sent: 2, failed_bonus_ids: [] })
    expect(resendSendMock).toHaveBeenCalledTimes(2)
    expect(resendSendMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@example.com',
      subject: '+25% Transfer Bonus: Chase Ultimate Rewards → Flying Blue',
    }))
    expect(await alertedAt('bonus-1')).not.toBeNull()

    // A second run has nothing left to alert.
    const again = await (await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))).json()
    expect(again).toEqual({ ok: true, bonuses_processed: 0, emails_sent: 0 })
  })

  it('never emails subscribers about unverified bonuses', async () => {
    await seedBonus('unverified', { verified: false })
    await db.insert(alertSubscriptions).values({ email: 'a@example.com', programIds: [testId('chase-ur')] })

    const body = await (await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))).json()

    expect(body.bonuses_processed).toBe(0)
    expect(resendSendMock).not.toHaveBeenCalled()
    expect(await alertedAt('unverified')).toBeNull()
  })

  it('leaves the bonus unalerted when every email fails so the next run retries', async () => {
    await seedBonus('bonus-2')
    await db.insert(alertSubscriptions).values({ email: 'a@example.com', programIds: [testId('chase-ur')] })
    resendSendMock.mockRejectedValueOnce(new Error('resend down'))

    const body = await (await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))).json()

    expect(body).toMatchObject({ ok: false, failed_bonus_ids: [testId('bonus-2')] })
    expect(await alertedAt('bonus-2')).toBeNull()
  })
})
