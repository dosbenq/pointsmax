// ============================================================
// Tests for /api/connectors
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase'

// Mocks
vi.mock('@/lib/supabase-server')
vi.mock('@/lib/supabase')
vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

const mockAdminClient = {
  from: vi.fn().mockReturnValue({
    insert: vi.fn().mockResolvedValue({ error: null }),
  }),
}

describe('/api/connectors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createSupabaseServerClient>)
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as unknown as ReturnType<typeof createAdminClient>)
  })

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const res = await GET()
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Unauthorized' })
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

      const res = await GET()
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'User record not found' })
    })

    it('returns enriched accounts with freshness info', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
      })
      
      const mockUserRow = { data: { id: 'user-456' }, error: null }
      const mockAccounts = {
        data: [
          {
            id: 'acc-1',
            user_id: 'user-456',
            provider: 'amex',
            display_name: 'My Amex',
            status: 'active',
            last_synced_at: new Date().toISOString(),
            sync_status: 'ok',
          },
        ],
        error: null,
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockUserRow),
              }),
            }),
          }
        }
        if (table === 'connected_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue(mockAccounts),
              }),
            }),
          }
        }
        return mockAdminClient.from(table)
      })

      const res = await GET()
      expect(res.status).toBe(200)
      
      const json = await res.json()
      expect(json.accounts).toHaveLength(1)
      expect(json.accounts[0].freshness).toBe('fresh')
      expect(json.accounts[0].hours_since_sync).toBeLessThan(1)
    })

    it('returns freshness: never for accounts that have never synced', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
      })
      
      const mockUserRow = { data: { id: 'user-456' }, error: null }
      const mockAccounts = {
        data: [
          {
            id: 'acc-2',
            user_id: 'user-456',
            provider: 'chase',
            display_name: 'My Chase',
            status: 'active',
            last_synced_at: null,
            sync_status: 'pending',
          },
        ],
        error: null,
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockUserRow),
              }),
            }),
          }
        }
        if (table === 'connected_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue(mockAccounts),
              }),
            }),
          }
        }
        return mockAdminClient.from(table)
      })

      const res = await GET()
      expect(res.status).toBe(200)
      
      const json = await res.json()
      expect(json.accounts[0].freshness).toBe('never')
      expect(json.accounts[0].hours_since_sync).toBeNull()
    })
  })

  describe('POST', () => {
    it('returns 401 when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const res = await POST(
        new Request('http://localhost/api/connectors', {
          method: 'POST',
          body: JSON.stringify({}),
        })
      )
      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid provider', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
      })
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'user-456' } }),
          }),
        }),
      })

      const res = await POST(
        new Request('http://localhost/api/connectors', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'invalid-provider',
            display_name: 'Test',
            token_vault_ref: 'vault-123',
            scopes: ['read'],
          }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('Invalid provider')
    })

    it('returns 400 for missing display_name', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
      })
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'user-456' } }),
          }),
        }),
      })

      const res = await POST(
        new Request('http://localhost/api/connectors', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'amex',
            token_vault_ref: 'vault-123',
            scopes: ['read'],
          }),
        })
      )
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'display_name is required' })
    })

    it('returns 400 for invalid scopes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
      })
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'user-456' } }),
          }),
        }),
      })

      const res = await POST(
        new Request('http://localhost/api/connectors', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'amex',
            display_name: 'Test',
            token_vault_ref: 'vault-123',
            scopes: [],
          }),
        })
      )
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'scopes must be a non-empty array' })
    })

    it('returns 409 for duplicate connection', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
      })

      // Build chain: select().eq().eq().maybeSingle()
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 'existing-acc', status: 'active' } })
      const eq2Mock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock })
      
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
              eq: eq1Mock,
            }),
          }
        }
        return mockAdminClient.from(table)
      })

      const res = await POST(
        new Request('http://localhost/api/connectors', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'amex',
            display_name: 'My Amex',
            token_vault_ref: 'vault-123',
            scopes: ['read', 'write'],
          }),
        })
      )
      expect(res.status).toBe(409)
      const json = await res.json()
      expect(json.error).toContain('already exists')
      expect(json.error).toContain('active')
    })

    it('creates new connected account successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
      })

      const mockAccount = {
        id: 'new-acc-789',
        user_id: 'user-456',
        provider: 'amex',
        display_name: 'My Amex',
        status: 'active',
        sync_status: 'pending',
        last_synced_at: null,
      }

      // Build chain: select().eq().eq().maybeSingle()
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null })
      const eq2Mock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock })
      
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
              eq: eq1Mock,
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAccount, error: null }),
              }),
            }),
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      })

      const res = await POST(
        new Request('http://localhost/api/connectors', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'amex',
            display_name: 'My Amex',
            token_vault_ref: 'vault-123',
            scopes: ['read', 'write'],
          }),
        })
      )
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.account.id).toBe('new-acc-789')
      expect(json.account.provider).toBe('amex')
      expect(json.account.sync_status).toBe('pending')
      expect(json.account.last_synced_at).toBeNull()
    })
  })
})
