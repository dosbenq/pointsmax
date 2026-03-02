import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─────────────────────────────────────────────
// Module mocks (must be declared before imports)
// ─────────────────────────────────────────────

// Default: authenticated user
let mockUser: { id: string } | null = { id: 'auth-uid-1' }
let mockUserRow: { id: string } | null = { id: 'user-row-1' }
let mockAccount: Record<string, unknown> | null = null
let mockSupabaseUpdateError: { message: string } | null = null

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
              data: table === 'connected_accounts' ? mockAccount : null,
              error: mockAccount === null && table === 'connected_accounts' ? { message: 'not found' } : null,
            }),
          }),
          single: async () => ({
            data: table === 'users' ? mockUserRow : null,
            error: null,
          }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: mockSupabaseUpdateError }),
      }),
    }),
  }),
}))

vi.mock('@/lib/connectors/token-vault', () => ({
  decryptToken: vi.fn().mockReturnValue('decrypted-token-123'),
}))

let mockSyncOutcome: Record<string, unknown> = { status: 'ok', result: { balances: {}, cursor: null } }

vi.mock('@/lib/connectors/sync-orchestrator', () => ({
  runAccountSync: vi.fn().mockImplementation(async () => mockSyncOutcome),
  isAccountStale: vi.fn().mockReturnValue(false),
  SYNC_POLICY: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 30000,
    staleThresholdMs: 14400000,
  },
}))

vi.mock('@/lib/connectors/connector-registry', () => ({
  connectorRegistry: {
    get: vi.fn().mockReturnValue({
      providerId: 'amex',
      displayName: 'American Express',
      capabilities: { supportsIncrementalSync: false, requiresOAuth: true, minSyncIntervalSeconds: 3600 },
      fetchBalance: vi.fn(),
      validateCredentials: vi.fn(),
    }),
  },
}))

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
    sync_status: 'pending',
    error_code: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function postRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/connectors/sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  mockUser = { id: 'auth-uid-1' }
  mockUserRow = { id: 'user-row-1' }
  mockAccount = makeActiveAccount()
  mockSupabaseUpdateError = null
  mockSyncOutcome = { status: 'ok', result: { balances: { 'prog-amex-mr': 50000 }, cursor: null } }
})

// ─────────────────────────────────────────────
// Auth guard
// ─────────────────────────────────────────────

describe('POST /api/connectors/sync — auth', () => {
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

describe('POST /api/connectors/sync — validation', () => {
  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('https://pointsmax.com/api/connectors/sync', {
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

  it('returns 400 when account_id is empty string', async () => {
    const res = await POST(postRequest({ account_id: '   ' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/account_id/)
  })
})

// ─────────────────────────────────────────────
// Account lookup
// ─────────────────────────────────────────────

describe('POST /api/connectors/sync — account lookup', () => {
  it('returns 404 when connected account is not found', async () => {
    mockAccount = null
    const res = await POST(postRequest({ account_id: 'nonexistent' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })

  it('returns 400 when account status is expired', async () => {
    mockAccount = makeActiveAccount({ status: 'expired' })
    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/expired/)
  })

  it('returns 400 when account status is revoked', async () => {
    mockAccount = makeActiveAccount({ status: 'revoked' })
    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/revoked/)
  })
})

// ─────────────────────────────────────────────
// Sync success state transition
// ─────────────────────────────────────────────

describe('POST /api/connectors/sync — sync success', () => {
  it('returns 200 with status ok on successful sync', async () => {
    mockSyncOutcome = {
      status: 'ok',
      result: { balances: { 'prog-amex-mr': 75000 }, cursor: null },
    }

    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.result).toBeDefined()
    expect(body.result.balances).toEqual({ 'prog-amex-mr': 75000 })
  })
})

// ─────────────────────────────────────────────
// Sync failure state transitions
// ─────────────────────────────────────────────

describe('POST /api/connectors/sync — sync failure transitions', () => {
  it('returns auth_error status when credentials are expired', async () => {
    mockSyncOutcome = {
      status: 'auth_error',
      message: 'Token expired',
    }

    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('auth_error')
    expect(body.message).toBe('Token expired')
  })

  it('returns error status with errorCode after exhausting retries', async () => {
    mockSyncOutcome = {
      status: 'error',
      errorCode: 'provider_error',
      message: 'Provider API unavailable',
      attempts: 3,
    }

    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('error')
    expect(body.errorCode).toBe('provider_error')
    expect(body.attempts).toBe(3)
  })

  it('returns error status with rate_limit errorCode', async () => {
    mockSyncOutcome = {
      status: 'error',
      errorCode: 'rate_limit',
      message: 'Rate limited — retry after 5000ms',
      attempts: 3,
    }

    const res = await POST(postRequest({ account_id: 'acct-001' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('error')
    expect(body.errorCode).toBe('rate_limit')
  })
})
