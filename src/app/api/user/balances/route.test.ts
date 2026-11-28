import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCatalogProgramBySlug } from '@/lib/catalog'

vi.mock('@/lib/supabase-server')

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

const CHASE_ID = getCatalogProgramBySlug('chase-ur')!.id
const AIR_INDIA_ID = getCatalogProgramBySlug('air-india')!.id

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

  it('returns saved balances with freshness metadata', async () => {
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
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await GET(new NextRequest('http://localhost/api/user/balances'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.balances).toHaveLength(1)

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
  })

  it('filters saved balances by region when a region parameter is provided', async () => {
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
                program_id: CHASE_ID,
                balance: 120000,
                updated_at: '2026-03-06T11:30:00.000Z',
              },
              {
                user_id: 'user-1',
                program_id: AIR_INDIA_ID,
                balance: 45000,
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
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await GET(new NextRequest('http://localhost/api/user/balances?region=IN'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.balances).toEqual([
      expect.objectContaining({
        program_id: AIR_INDIA_ID,
        balance: 45000,
        source: 'manual',
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
