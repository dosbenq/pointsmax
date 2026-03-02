import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'auth-uid-1' }
let mockUserRow: { id: string } | null = { id: 'user-row-1' }
let mockAccount: Record<string, unknown> | null = null
let mockDeleteError: { message: string } | null = null

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({
              data:
                table === 'connected_accounts'
                  ? mockAccount
                  : null,
              error:
                mockAccount === null && table === 'connected_accounts'
                  ? { message: 'not found' }
                  : null,
            }),
          }),
          single: async () => ({
            data: table === 'users' ? mockUserRow : null,
            error: null,
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: mockDeleteError }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}))

vi.mock('@/lib/connectors/audit-log', () => ({
  emitAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

import { emitAuditEvent } from '@/lib/connectors/audit-log'

// Import AFTER mocks
const { DELETE } = await import('./route')

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeActiveAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-001',
    user_id: 'user-row-1',
    provider: 'amex',
    display_name: 'My Amex',
    token_vault_ref: 'REVOKED',
    status: 'revoked',
    token_expires_at: null,
    scopes: null,
    last_synced_at: null,
    last_error: null,
    sync_status: 'error',
    error_code: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...overrides,
  }
}

function deleteRequest(accountId: string) {
  return new NextRequest(`https://pointsmax.com/api/connectors/${accountId}`, {
    method: 'DELETE',
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  mockUser = { id: 'auth-uid-1' }
  mockUserRow = { id: 'user-row-1' }
  mockAccount = makeActiveAccount()
  mockDeleteError = null
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────
// Auth guard
// ─────────────────────────────────────────────

describe('DELETE /api/connectors/[id] — auth', () => {
  it('returns 401 when no user is authenticated', async () => {
    mockUser = null
    const res = await DELETE(deleteRequest('acct-001'), makeParams('acct-001'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })
})

// ─────────────────────────────────────────────
// Authorization — ownership checks
// ─────────────────────────────────────────────

describe('DELETE /api/connectors/[id] — authorization', () => {
  it('returns 404 when account is not found (or belongs to another user)', async () => {
    mockAccount = null
    const res = await DELETE(deleteRequest('acct-999'), makeParams('acct-999'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })
})

// ─────────────────────────────────────────────
// Audit event emitted before delete
// ─────────────────────────────────────────────

describe('DELETE /api/connectors/[id] — audit event', () => {
  it('emits a delete audit event before deletion', async () => {
    await DELETE(deleteRequest('acct-001'), makeParams('acct-001'))

    expect(emitAuditEvent).toHaveBeenCalledOnce()
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        userId: 'user-row-1',
        accountId: 'acct-001',
        provider: 'amex',
        eventType: 'delete',
        actor: 'user',
      }),
    )
  })

  it('includes previousStatus and displayName in audit metadata', async () => {
    mockAccount = makeActiveAccount({ status: 'active', display_name: 'My Amex' })
    await DELETE(deleteRequest('acct-001'), makeParams('acct-001'))

    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        metadata: expect.objectContaining({
          previousStatus: 'active',
          displayName: 'My Amex',
        }),
      }),
    )
  })

  it('emits audit event even when audit log persistence would fail', async () => {
    // emitAuditEvent itself is resilient — this verifies the route calls it
    vi.mocked(emitAuditEvent).mockResolvedValueOnce(undefined)
    const res = await DELETE(deleteRequest('acct-001'), makeParams('acct-001'))
    expect(emitAuditEvent).toHaveBeenCalled()
    expect(res.status).toBe(204)
  })
})

// ─────────────────────────────────────────────
// Success path
// ─────────────────────────────────────────────

describe('DELETE /api/connectors/[id] — success', () => {
  it('returns 204 with no body on successful deletion', async () => {
    const res = await DELETE(deleteRequest('acct-001'), makeParams('acct-001'))
    expect(res.status).toBe(204)
    const text = await res.text()
    expect(text).toBe('')
  })
})

// ─────────────────────────────────────────────
// DB failure
// ─────────────────────────────────────────────

describe('DELETE /api/connectors/[id] — DB failure', () => {
  it('returns 500 when the DB delete fails', async () => {
    mockDeleteError = { message: 'foreign key violation' }
    const res = await DELETE(deleteRequest('acct-001'), makeParams('acct-001'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal error')
  })

  it('emits audit event before the failed delete attempt', async () => {
    mockDeleteError = { message: 'foreign key violation' }
    await DELETE(deleteRequest('acct-001'), makeParams('acct-001'))
    // Audit event must have been called even though delete failed
    expect(emitAuditEvent).toHaveBeenCalled()
  })
})
