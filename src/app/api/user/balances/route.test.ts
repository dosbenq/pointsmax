import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import { createSupabaseServerClient } from '@/lib/supabase-server'

vi.mock('@/lib/supabase-server')

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

describe('/api/user/balances', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-06T12:00:00.000Z'))
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const res = await GET(new NextRequest('http://localhost/api/user/balances'))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('merges manual balances with latest connected snapshots and preserves metadata', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
            }),
          }),
        }
      }
      if (table === 'user_balances') {
        const userBalancesQuery = {
          in: vi.fn().mockResolvedValue({
            data: [
              {
                user_id: 'user-1',
                program_id: 'chase-ur',
                balance: 120000,
                updated_at: '2026-03-06T11:30:00.000Z',
              },
            ],
            error: null,
          }),
        }
        return {
          select: vi.fn().mockReturnValue(userBalancesQuery),
        }
      }
      if (table === 'connected_accounts') {
        const connectedAccountsQuery = {
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'acct-1',
                user_id: 'user-1',
                status: 'active',
                sync_status: 'ok',
                last_synced_at: '2026-03-06T11:00:00.000Z',
              },
            ],
            error: null,
          }),
        }
        return {
          select: vi.fn().mockReturnValue(connectedAccountsQuery),
        }
      }
      if (table === 'balance_snapshots') {
        const balanceSnapshotsQuery = {
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  user_id: 'user-1',
                  connected_account_id: 'acct-1',
                  program_id: 'amex-mr',
                  balance: 90000,
                  source: 'connector',
                  fetched_at: '2026-03-06T10:00:00.000Z',
                },
                {
                  user_id: 'user-1',
                  connected_account_id: 'acct-1',
                  program_id: 'chase-ur',
                  balance: 100000,
                  source: 'connector',
                  fetched_at: '2026-03-06T09:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }
        return {
          select: vi.fn().mockReturnValue(balanceSnapshotsQuery),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await GET(new NextRequest('http://localhost/api/user/balances'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.balances).toHaveLength(2)

    expect(body.balances).toContainEqual(
      expect.objectContaining({
        program_id: 'chase-ur',
        balance: 120000,
        source: 'manual',
        connected_account_id: null,
        sync_status: null,
        confidence: 'high',
        is_stale: false,
      }),
    )

    expect(body.balances).toContainEqual(
      expect.objectContaining({
        program_id: 'amex-mr',
        balance: 90000,
        source: 'connector',
        connected_account_id: 'acct-1',
        sync_status: 'ok',
        confidence: 'high',
        is_stale: false,
      }),
    )
  })

  it('filters unified balances by region when a region parameter is provided', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
            }),
          }),
        }
      }
      if (table === 'user_balances') {
        const userBalancesQuery = {
          in: vi.fn().mockResolvedValue({
            data: [
              {
                user_id: 'user-1',
                program_id: 'chase-ur',
                balance: 120000,
                updated_at: '2026-03-06T11:30:00.000Z',
              },
            ],
            error: null,
          }),
        }
        return {
          select: vi.fn().mockReturnValue(userBalancesQuery),
        }
      }
      if (table === 'connected_accounts') {
        const connectedAccountsQuery = {
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'acct-1', user_id: 'user-1', status: 'active', sync_status: 'ok', last_synced_at: null }],
            error: null,
          }),
        }
        return {
          select: vi.fn().mockReturnValue(connectedAccountsQuery),
        }
      }
      if (table === 'balance_snapshots') {
        const balanceSnapshotsQuery = {
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  user_id: 'user-1',
                  connected_account_id: 'acct-1',
                  program_id: 'amex-mr',
                  balance: 90000,
                  source: 'connector',
                  fetched_at: '2026-03-06T10:00:00.000Z',
                },
                {
                  user_id: 'user-1',
                  connected_account_id: 'acct-1',
                  program_id: 'air-india',
                  balance: 10000,
                  source: 'connector',
                  fetched_at: '2026-03-06T10:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }
        return {
          select: vi.fn().mockReturnValue(balanceSnapshotsQuery),
        }
      }
      if (table === 'programs') {
        const programsQuery = {
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 'air-india', geography: 'IN' },
              { id: 'taj-innercircle', geography: 'global' },
            ],
            error: null,
          }),
        }
        return {
          select: vi.fn().mockReturnValue(programsQuery),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await GET(new NextRequest('http://localhost/api/user/balances?region=IN'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.balances).toEqual([
      expect.objectContaining({
        program_id: 'air-india',
        source: 'connector',
      }),
    ])
  })

  it('accepts valid POST payloads unchanged', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } })

    const upsert = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
            }),
          }),
        }
      }
      if (table === 'user_balances') {
        return {
          upsert,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await POST(
      new NextRequest('http://localhost/api/user/balances', {
        method: 'POST',
        body: JSON.stringify({
          balances: [{ program_id: 'chase-ur', balance: 12345 }],
        }),
      }),
    )

    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalled()
  })
})
