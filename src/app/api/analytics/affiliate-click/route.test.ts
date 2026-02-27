import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createAdminClientMock = vi.fn()
const createSupabaseServerClientMock = vi.fn()
const enforceJsonContentLengthMock = vi.fn()
const enforceRateLimitMock = vi.fn()
const logInfoMock = vi.fn()
const logWarnMock = vi.fn()
const logErrorMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}))

vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: enforceJsonContentLengthMock,
  enforceRateLimit: enforceRateLimitMock,
}))

vi.mock('@/lib/logger', () => ({
  getRequestId: () => 'test-request-id',
  logInfo: logInfoMock,
  logWarn: logWarnMock,
  logError: logErrorMock,
}))

const { POST } = await import('./route')

describe('POST /api/analytics/affiliate-click', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceJsonContentLengthMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
  })

  it('rejects invalid card id with 400', async () => {
    const dbClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      }),
    }
    createAdminClientMock.mockReturnValue(dbClient)

    const req = new NextRequest('http://localhost/api/analytics/affiliate-click', {
      method: 'POST',
      body: JSON.stringify({ card_id: 'invalid-id' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toBe('Unknown card_id')
  })

  it('successfully records click with attribution fields', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const dbClient = {
      from: vi.fn((table) => {
        if (table === 'cards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'card-123', apply_url: 'https://bank.com/apply' },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'affiliate_clicks') {
          return {
            insert: insertMock,
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }
      }),
    }
    createAdminClientMock.mockReturnValue(dbClient)

    const req = new NextRequest('http://localhost/api/analytics/affiliate-click', {
      method: 'POST',
      body: JSON.stringify({
        card_id: 'card-123',
        source_page: 'recommender',
        rank: 1,
        region: 'US',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        card_id: 'card-123',
        source_page: 'recommender',
        rank: 1,
        region: 'us',
      })
    )
  })
})
