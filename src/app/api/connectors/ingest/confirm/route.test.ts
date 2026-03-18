import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

const { POST } = await import('./route')

function installDefaultDbMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 'internal-user-1' }, error: null }),
          }),
        }),
      }
    }

    if (table === 'user_balances') {
      return {
        upsert: (...args: unknown[]) => {
          const result = mockUpsert(...args)
          return result === undefined ? Promise.resolve({ error: null }) : result
        },
      }
    }

    throw new Error(`Unexpected table ${table}`)
  })
}

describe('POST /api/connectors/ingest/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installDefaultDbMocks()
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(new NextRequest('http://localhost/api/connectors/ingest/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidates: [{ program_id: 'prog-1', balance: 1000 }] }),
    }))

    expect(response.status).toBe(401)
  })

  it('rejects invalid payloads', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } } })

    const response = await POST(new NextRequest('http://localhost/api/connectors/ingest/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidates: [] }),
    }))

    expect(response.status).toBe(400)
  })

  it('upserts selected balances into user_balances', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } } })

    const response = await POST(new NextRequest('http://localhost/api/connectors/ingest/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: [
          { program_id: 'prog-chase', balance: 45234 },
          { program_id: 'prog-amex', balance: 87400 },
        ],
      }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, saved_count: 2 })
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: 'internal-user-1',
          program_id: 'prog-chase',
          balance: 45234,
        }),
        expect.objectContaining({
          user_id: 'internal-user-1',
          program_id: 'prog-amex',
          balance: 87400,
        }),
      ],
      { onConflict: 'user_id,program_id' },
    )
  })
})
