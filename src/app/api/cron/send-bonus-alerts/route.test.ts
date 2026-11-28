import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getCatalogProgramBySlug, getCatalogTransferPartners } from '@/lib/catalog'

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
  subscribers?: Array<{ email: string; program_ids: string[] }>
}) {
  const updateEqMock = vi.fn(async () => ({ error: null }))
  const verifiedFilterMock = vi.fn()

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'transfer_bonuses') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: unknown) => {
              verifiedFilterMock(column, value)
              return {
                lte: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    is: vi.fn(async () => ({ data: opts.bonuses ?? [], error: null })),
                  })),
                })),
              }
            }),
          })),
          update: vi.fn(() => ({
            eq: updateEqMock,
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

  return { client, updateEqMock, verifiedFilterMock }
}

const CHASE_ID = getCatalogProgramBySlug('chase-ur')!.id
const FLYING_BLUE_ID = getCatalogProgramBySlug('flying-blue')!.id
const CHASE_TO_FLYING_BLUE = getCatalogTransferPartners()
  .find((row) => row.from_program_id === CHASE_ID && row.to_program_id === FLYING_BLUE_ID)!

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
    const { client, updateEqMock, verifiedFilterMock } = makeDbClient({
      bonuses: [
        {
          id: 'bonus-1',
          transfer_partner_id: CHASE_TO_FLYING_BLUE.id,
          bonus_pct: 25,
          start_date: '2026-02-01',
          end_date: '2026-02-28',
        },
      ],
      subscribers: [
        { email: 'a@example.com', program_ids: [CHASE_ID] },
        { email: 'b@example.com', program_ids: [CHASE_ID] },
        { email: 'a@example.com', program_ids: [CHASE_ID] },
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
    expect(verifiedFilterMock).toHaveBeenCalledWith('is_verified', true)
    expect(resendSendMock).toHaveBeenCalledWith(expect.objectContaining({
      subject: '+25% Transfer Bonus: Chase Ultimate Rewards → Air France/KLM Flying Blue',
    }))
  })
})
