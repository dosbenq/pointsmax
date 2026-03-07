// ============================================================
// Lifecycle Integration Tests for Connected Wallet APIs
//
// This suite verifies the full lifecycle of a connector:
// 1. Create (POST /api/connectors)
// 2. List (GET /api/connectors)
// 3. Sync (POST /api/connectors/sync)
// 4. Disconnect (POST /api/connectors/disconnect)
// 5. Delete (DELETE /api/connectors/[id])
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as listAccounts, POST as createAccount } from './route'
import { POST as syncAccount } from './sync/route'
import { POST as disconnectAccount } from './disconnect/route'
import { DELETE as deleteAccount } from './[id]/route'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Shared Mocks
// ─────────────────────────────────────────────

vi.mock('@/lib/supabase-server')
vi.mock('@/lib/supabase')
vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))
vi.mock('@/lib/connectors/token-vault', () => ({
  decryptToken: vi.fn().mockReturnValue('mock-decrypted-token'),
  encryptToken: vi.fn().mockReturnValue('mock-vault-ref'),
}))
vi.mock('@/lib/connectors/sync-orchestrator', () => ({
  runAccountSync: vi.fn().mockImplementation(async (_adapter, context, persistence) => {
    const result = { balances: { 'p1': 100 }, cursor: null }
    await persistence.markSyncing(context.account.id)
    await persistence.markSuccess(context.account.id, result)
    return { status: 'ok', result }
  }),
  isAccountStale: vi.fn().mockReturnValue(true),
  SYNC_POLICY: { staleThresholdMs: 3600000 }
}))
vi.mock('@/lib/connectors/adapters', () => ({
  ensureConnectorRegistryInitialized: vi.fn(),
}))
vi.mock('@/lib/connectors/connector-registry', () => ({
  connectorRegistry: {
    get: vi.fn().mockReturnValue({ providerId: 'amex', implemented: true }),
  },
}))

const mockUser = { id: 'auth-123' }
const mockUserRow = { id: 'user-456' }

describe('Connected Wallet Lifecycle', () => {
  type DbRow = Record<string, unknown>
  let db: Record<string, DbRow[]> = {
    connected_accounts: [],
  }

  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((col: string, val: unknown) => ({
          eq: vi.fn((col2: string, val2: unknown) => ({
            single: vi.fn().mockImplementation(() => {
              if (table === 'users') return { data: mockUserRow }
              const found = db[table]?.find(row => row[col] === val && row[col2] === val2)
              return { data: found || null, error: found ? null : { message: 'Not found' } }
            }),
            maybeSingle: vi.fn().mockImplementation(() => {
              const found = db[table]?.find(row => row[col] === val && row[col2] === val2)
              return { data: found || null }
            })
          })),
          single: vi.fn().mockImplementation(() => {
            if (table === 'users') return { data: mockUserRow }
            const found = db[table]?.find(row => row[col] === val)
            return { data: found || null, error: found ? null : { message: 'Not found' } }
          }),
          order: vi.fn().mockImplementation(() => ({
            data: db[table]?.filter(row => row[col] === val) || [],
            error: null
          })),
          maybeSingle: vi.fn().mockImplementation(() => {
             const found = db[table]?.find(row => row[col] === val)
             return { data: found || null }
          })
        })),
      })),
      insert: vi.fn((row: DbRow) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(() => {
            const newRow = { ...row, id: 'acc-' + Math.random().toString(36).substr(2, 9), created_at: new Date().toISOString() }
            db[table].push(newRow)
            return { data: newRow, error: null }
          })
        })
      })),
      update: vi.fn((updates: DbRow) => ({
        eq: vi.fn((col: string, val: unknown) => ({
          eq: vi.fn((col2: string, val2: unknown) => {
            const idx = db[table].findIndex(row => row[col] === val && row[col2] === val2)
            if (idx !== -1) db[table][idx] = { ...db[table][idx], ...updates }
            return Promise.resolve({ error: null })
          }),
          then: (resolve: (value: { error: null }) => unknown) => {
            const idx = db[table].findIndex(row => row[col] === val)
            if (idx !== -1) db[table][idx] = { ...db[table][idx], ...updates }
            return resolve({ error: null })
          }
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn((col: string, val: unknown) => ({
          eq: vi.fn((col2: string, val2: unknown) => {
            db[table] = db[table].filter(row => !(row[col] === val && row[col2] === val2))
            return Promise.resolve({ error: null })
          })
        }))
      }))
    })),
  }

  const mockAdminClient = {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    db = { connected_accounts: [] }
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never)
  })

  it('performs a full account lifecycle correctly', async () => {
    // 1. CREATE
    const createReq = new NextRequest('http://localhost/api/connectors', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'amex',
        display_name: 'Amex Lifecycle',
        token_vault_ref: 'vault-ref-123',
        scopes: ['read', 'write']
      })
    })
    const createRes = await createAccount(createReq)
    expect(createRes.status).toBe(201)
    const { account } = await createRes.json()
    expect(account.id).toBeDefined()
    expect(account.sync_status).toBe('pending')

    // 2. LIST
    const listRes = await listAccounts()
    expect(listRes.status).toBe(200)
    const { accounts } = await listRes.json()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].id).toBe(account.id)
    expect(accounts[0].freshness).toBe('never')

    // 3. SYNC
    const syncReq = new NextRequest('http://localhost/api/connectors/sync', {
      method: 'POST',
      body: JSON.stringify({ account_id: account.id })
    })
    const syncRes = await syncAccount(syncReq)
    expect(syncRes.status).toBe(200)
    const syncResult = await syncRes.json()
    expect(syncResult.status).toBe('ok')
    
    // Verify sync updated the record (in our mock DB)
    expect(db.connected_accounts[0].sync_status).toBe('ok')
    expect(db.connected_accounts[0].last_synced_at).toBeDefined()

    // 4. DISCONNECT
    const discReq = new NextRequest('http://localhost/api/connectors/disconnect', {
      method: 'POST',
      body: JSON.stringify({ account_id: account.id })
    })
    const discRes = await disconnectAccount(discReq)
    expect(discRes.status).toBe(200)
    expect(db.connected_accounts[0].status).toBe('revoked')
    expect(db.connected_accounts[0].token_vault_ref).toBe('REVOKED')

    // 5. DELETE
    const delRes = await deleteAccount(new NextRequest('http://localhost'), { params: Promise.resolve({ id: account.id }) })
    expect(delRes.status).toBe(204)
    expect(db.connected_accounts).toHaveLength(0)
  })
})
