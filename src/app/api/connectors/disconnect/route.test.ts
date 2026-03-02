import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'auth-uid-1' }
let mockUserRow: { id: string } | null = { id: 'user-row-1' }
let mockAccount: Record<string, unknown> | null = null
let mockUpdateError: { message: string } | null = null
let mockAuditInsertError: { message: string } | null = null

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
      update: () => ({
        eq: () => ({
          eq: () =>
            Promise.resolve({ error: mockUpdateError }),
        }),
      }),
      insert: () =>
        Promise.resolve({ error: mockAuditInsertError }),
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
const { POST } = await import('./route')

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeActiveAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-001',
    user_id: 'user-row-1',
    provider: 'amex',
    display_name: null,
    token_vault_ref: 'vault-ref-enc',
    status: 'active',
    token_expires_at: null,
    scopes: null,
    last_synced_at: null,
    last_error: null,
    sync_status: 'ok',
    error_code: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function postRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/connectors/disconnect', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  mockUser = { id: 'auth-uid-1' }
  mockUserRow = { id: 'user-row-1' }
  mockAccount = makeActiveAccount()
  mockUpdateError = null
  mockAuditInsertError = null
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────
// Auth guard
// ─────────────────────────────────────────────

describe('POST /api/connectors/disconnect — auth', () => {
  it('returns 401 when no user is authenticated', async () => {
    mockUser = null
    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })
})

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

describe('POST /api/connectors/disconnect — validation', () => {
  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('https://pointsmax.com/api/connectors/disconnect', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when account_id is missing', async () => {
    const res = await POST(postRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/account_id/)
  })

  it('returns 400 when account_id is blank', async () => {
    const res = await POST(postRequest({ account_id: '   ' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/account_id/)
  })
})

// ─────────────────────────────────────────────
// Authorization — ownership checks
// ─────────────────────────────────────────────

describe('POST /api/connectors/disconnect — authorization', () => {
  it('returns 404 when account does not belong to the calling user', async () => {
    mockAccount = null
    const res = await POST(postRequest({ account_id: 'acct-999' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })

  it('returns 400 when account is already revoked', async () => {
    mockAccount = makeActiveAccount({ status: 'revoked' })
    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already disconnected/i)
  })
})

// ─────────────────────────────────────────────
// Success path
// ─────────────────────────────────────────────

describe('POST /api/connectors/disconnect — success', () => {
  it('returns 200 with status ok on successful disconnect', async () => {
    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('emits a disconnect audit event on success', async () => {
    await POST(postRequest({ account_id: 'acct-001' }))

    expect(emitAuditEvent).toHaveBeenCalledOnce()
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        userId: 'user-row-1',
        accountId: 'acct-001',
        provider: 'amex',
        eventType: 'disconnect',
        actor: 'user',
      }),
    )
  })

  it('includes previousStatus in audit metadata', async () => {
    mockAccount = makeActiveAccount({ status: 'expired' })
    await POST(postRequest({ account_id: 'acct-001' }))

    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        metadata: expect.objectContaining({ previousStatus: 'expired' }),
      }),
    )
  })
})

// ─────────────────────────────────────────────
// DB failure
// ─────────────────────────────────────────────

describe('POST /api/connectors/disconnect — DB failure', () => {
  it('returns 500 when the DB update fails', async () => {
    mockUpdateError = { message: 'connection refused' }
    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal error')
  })

  it('does not emit audit event when DB update fails', async () => {
    mockUpdateError = { message: 'connection refused' }
    await POST(postRequest({ account_id: 'acct-001' }))
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })
})
