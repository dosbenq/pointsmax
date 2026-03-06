// ============================================================
// Tests for /api/connectors/[id]/balances
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Mocks
vi.mock('@/lib/supabase-server')

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

describe('/api/connectors/[id]/balances', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createSupabaseServerClient>)
  })

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const res = await GET(
      new Request('http://localhost/api/connectors/acc-123/balances'),
      { params: Promise.resolve({ id: 'acc-123' }) }
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when account id is missing', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-123' } },
    })

    const res = await GET(
      new Request('http://localhost/api/connectors//balances'),
      { params: Promise.resolve({ id: '' }) }
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Account ID is required' })
  })

  it('returns 404 when user record not found', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-123' } },
    })
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    })

    const res = await GET(
      new Request('http://localhost/api/connectors/acc-123/balances'),
      { params: Promise.resolve({ id: 'acc-123' }) }
    )
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User record not found' })
  })

  it('returns 404 when account not found or not owned by user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-123' } },
    })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-456' } }),
            }),
          }),
        }
      }
      if (table === 'connected_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await GET(
      new Request('http://localhost/api/connectors/acc-123/balances'),
      { params: Promise.resolve({ id: 'acc-123' }) }
    )
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Account not found' })
  })

  it('returns balance snapshots successfully', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-123' } },
    })

    const mockBalances = [
      {
        id: 'snap-1',
        connected_account_id: 'acc-123',
        user_id: 'user-456',
        program_id: 'prog-1',
        balance: 50000,
        source: 'connector',
        provider_cursor: 'cursor-1',
        fetched_at: new Date().toISOString(),
      },
      {
        id: 'snap-2',
        connected_account_id: 'acc-123',
        user_id: 'user-456',
        program_id: 'prog-1',
        balance: 48000,
        source: 'connector',
        provider_cursor: 'cursor-0',
        fetched_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ]

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-456' } }),
            }),
          }),
        }
      }
      if (table === 'connected_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'acc-123' } }),
              }),
            }),
          }),
        }
      }
      if (table === 'balance_snapshots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockBalances, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await GET(
      new Request('http://localhost/api/connectors/acc-123/balances'),
      { params: Promise.resolve({ id: 'acc-123' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.balances).toHaveLength(2)
    expect(json.balances[0].balance).toBe(50000)
    expect(json.balances[0].source).toBe('connector')
  })

  it('respects limit parameter', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-123' } },
    })

    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-456' } }),
            }),
          }),
        }
      }
      if (table === 'connected_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'acc-123' } }),
              }),
            }),
          }),
        }
      }
      if (table === 'balance_snapshots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: limitMock,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await GET(
      new Request('http://localhost/api/connectors/acc-123/balances?limit=5'),
      { params: Promise.resolve({ id: 'acc-123' }) }
    )
    expect(res.status).toBe(200)
    expect(limitMock).toHaveBeenCalledWith(5)
  })

  it('caps limit at 100', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-123' } },
    })

    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-456' } }),
            }),
          }),
        }
      }
      if (table === 'connected_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'acc-123' } }),
              }),
            }),
          }),
        }
      }
      if (table === 'balance_snapshots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: limitMock,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await GET(
      new Request('http://localhost/api/connectors/acc-123/balances?limit=200'),
      { params: Promise.resolve({ id: 'acc-123' }) }
    )
    expect(res.status).toBe(200)
    expect(limitMock).toHaveBeenCalledWith(100)
  })
})
