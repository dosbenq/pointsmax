import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createAdminClientMock = vi.fn()
const createUnsubscribeTokenMock = vi.fn(() => 'token-123')
const resendSendMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createAdminClient: createAdminClientMock,
}))

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

function makeDbClient(opts: {
  bonuses?: Array<{ id: string; transfer_partner_id: string; bonus_pct: number; start_date: string; end_date: string }>
  partners?: Array<{
    id: string
    from_program_id: string
    to_program_id: string
    from_program: { name: string }
    to_program: { name: string }
  }>
  subscribers?: Array<{ email: string; program_ids: string[] }>
}) {
  const updateEqMock = vi.fn(async () => ({ error: null }))

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'transfer_bonuses') {
        return {
          select: vi.fn(() => ({
            lte: vi.fn(() => ({
              gte: vi.fn(() => ({
                is: vi.fn(async () => ({ data: opts.bonuses ?? [], error: null })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: updateEqMock,
          })),
        }
      }

      if (table === 'transfer_partners') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: opts.partners ?? [], error: null })),
          })),
        }
      }

      if (table === 'alert_subscriptions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              overlaps: vi.fn(async () => ({ data: opts.subscribers ?? [], error: null })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { client, updateEqMock }
}

describe('GET /api/cron/send-bonus-alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM_EMAIL = 'alerts@pointsmax.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'
  })

  it('returns 401 when auth is missing or invalid', async () => {
    const { client } = makeDbClient({})
    createAdminClientMock.mockReturnValue(client)

    const unauthorized = await GET(makeRequest())
    const wrongSecret = await GET(makeRequest({ authHeader: 'Bearer nope' }))
    const queryParamOnly = await GET(makeRequest({ secretParam: 'cron-secret' }))

    expect(unauthorized.status).toBe(401)
    expect(wrongSecret.status).toBe(401)
    expect(queryParamOnly.status).toBe(401)
  })

  it('returns success with no work when there are no active bonuses', async () => {
    const { client } = makeDbClient({ bonuses: [] })
    createAdminClientMock.mockReturnValue(client)

    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, bonuses_processed: 0, emails_sent: 0 })
    expect(resendSendMock).not.toHaveBeenCalled()
  })

  it('sends bonus emails and marks bonus as alerted', async () => {
    const { client, updateEqMock } = makeDbClient({
      bonuses: [
        {
          id: 'bonus-1',
          transfer_partner_id: 'tp-1',
          bonus_pct: 25,
          start_date: '2026-02-01',
          end_date: '2026-02-28',
        },
      ],
      partners: [
        {
          id: 'tp-1',
          from_program_id: 'prog-1',
          to_program_id: 'prog-2',
          from_program: { name: 'Chase Ultimate Rewards' },
          to_program: { name: 'Flying Blue' },
        },
      ],
      subscribers: [
        { email: 'a@example.com', program_ids: ['prog-1'] },
        { email: 'b@example.com', program_ids: ['prog-1'] },
        { email: 'a@example.com', program_ids: ['prog-1'] },
      ],
    })
    createAdminClientMock.mockReturnValue(client)

    const res = await GET(makeRequest({ authHeader: 'Bearer cron-secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.bonuses_processed).toBe(1)
    expect(body.emails_sent).toBe(2)
    expect(body.failed_bonus_ids).toEqual([])
    expect(resendSendMock).toHaveBeenCalledTimes(2)
    expect(updateEqMock).toHaveBeenCalledWith('id', 'bonus-1')
  })
})
