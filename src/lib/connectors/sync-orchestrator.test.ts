import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  runAccountSync,
  isAccountStale,
  SYNC_POLICY,
  type SyncPersistence,
} from './sync-orchestrator'
import type { ProviderAdapter } from './connector-interface'
import { ProviderAuthError, ProviderRateLimitError, ProviderError } from './connector-interface'
import type { ConnectorContext, FetchBalanceResult } from '@/types/connectors'
import { _clearDlqStore, getDlqEntries } from '@/lib/queue-durability'

// ─────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-123',
    user_id: 'user-abc',
    provider: 'amex' as const,
    display_name: null,
    token_vault_ref: 'vault-ref',
    status: 'active' as const,
    token_expires_at: null,
    scopes: null,
    last_synced_at: null,
    last_error: null,
    sync_status: 'pending' as const,
    error_code: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeContext(overrides: Partial<ConnectorContext> = {}): ConnectorContext {
  return {
    accessToken: 'tok_test',
    userId: 'user-abc',
    account: makeAccount(),
    ...overrides,
  }
}

const SUCCESS_RESULT: FetchBalanceResult = {
  balances: { 'prog-amex-mr': 75_000 },
  cursor: null,
}

function makeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    providerId: 'amex',
    displayName: 'American Express',
    capabilities: {
      supportsIncrementalSync: false,
      requiresOAuth: true,
      minSyncIntervalSeconds: 3600,
    },
    fetchBalance: vi.fn().mockResolvedValue(SUCCESS_RESULT),
    validateCredentials: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

function makePersistence(): { mock: SyncPersistence; calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {
    markSyncing: [],
    markSuccess: [],
    markError: [],
    markAuthError: [],
  }
  const mock: SyncPersistence = {
    markSyncing: vi.fn().mockImplementation(async (id) => { calls.markSyncing.push([id]) }),
    markSuccess: vi.fn().mockImplementation(async (id, r) => { calls.markSuccess.push([id, r]) }),
    markError: vi.fn().mockImplementation(async (id, code, msg) => {
      calls.markError.push([id, code, msg])
    }),
    markAuthError: vi.fn().mockImplementation(async (id) => { calls.markAuthError.push([id]) }),
  }
  return { mock, calls }
}

const noopSleep = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  _clearDlqStore()
  noopSleep.mockClear()
})

// ─────────────────────────────────────────────
// isAccountStale
// ─────────────────────────────────────────────

describe('isAccountStale', () => {
  it('returns true when last_synced_at is null (never synced)', () => {
    expect(isAccountStale({ last_synced_at: null })).toBe(true)
  })

  it('returns false when last_synced_at is within the threshold', () => {
    const now = new Date('2026-03-01T12:00:00Z')
    const syncedAt = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
    expect(isAccountStale({ last_synced_at: syncedAt }, SYNC_POLICY.staleThresholdMs, now)).toBe(false)
  })

  it('returns true when last_synced_at is exactly at the threshold', () => {
    const now = new Date('2026-03-01T12:00:00Z')
    const syncedAt = new Date(now.getTime() - SYNC_POLICY.staleThresholdMs).toISOString()
    expect(isAccountStale({ last_synced_at: syncedAt }, SYNC_POLICY.staleThresholdMs, now)).toBe(true)
  })

  it('returns true when last_synced_at is older than the threshold', () => {
    const now = new Date('2026-03-01T12:00:00Z')
    const syncedAt = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago
    expect(isAccountStale({ last_synced_at: syncedAt }, SYNC_POLICY.staleThresholdMs, now)).toBe(true)
  })

  it('accepts a custom threshold', () => {
    const now = new Date('2026-03-01T12:00:00Z')
    const syncedAt = new Date(now.getTime() - 10 * 60 * 1000).toISOString() // 10 min ago
    const tenMinMs = 10 * 60 * 1000
    expect(isAccountStale({ last_synced_at: syncedAt }, tenMinMs, now)).toBe(true)
    expect(isAccountStale({ last_synced_at: syncedAt }, tenMinMs + 1, now)).toBe(false)
  })
})

// ─────────────────────────────────────────────
// SYNC_POLICY constants
// ─────────────────────────────────────────────

describe('SYNC_POLICY', () => {
  it('caps maxAttempts to a finite number (no infinite retries)', () => {
    expect(SYNC_POLICY.maxAttempts).toBeGreaterThan(0)
    expect(SYNC_POLICY.maxAttempts).toBeLessThanOrEqual(10)
  })

  it('has a positive initialDelayMs', () => {
    expect(SYNC_POLICY.initialDelayMs).toBeGreaterThan(0)
  })

  it('has a maxDelayMs greater than initialDelayMs', () => {
    expect(SYNC_POLICY.maxDelayMs).toBeGreaterThan(SYNC_POLICY.initialDelayMs)
  })

  it('has a positive staleThresholdMs', () => {
    expect(SYNC_POLICY.staleThresholdMs).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────
// runAccountSync — success path
// ─────────────────────────────────────────────

describe('runAccountSync — success', () => {
  it('returns ok outcome with fetch result', async () => {
    const adapter = makeAdapter()
    const ctx = makeContext()
    const { mock } = makePersistence()

    const outcome = await runAccountSync(adapter, ctx, mock, noopSleep)

    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      expect(outcome.result).toEqual(SUCCESS_RESULT)
    }
  })

  it('calls markSyncing then markSuccess', async () => {
    const adapter = makeAdapter()
    const ctx = makeContext()
    const { mock } = makePersistence()
    const order: string[] = []
    vi.mocked(mock.markSyncing).mockImplementation(async () => { order.push('syncing') })
    vi.mocked(mock.markSuccess).mockImplementation(async () => { order.push('success') })

    await runAccountSync(adapter, ctx, mock, noopSleep)

    expect(order).toEqual(['syncing', 'success'])
  })

  it('does not record a DLQ entry on success', async () => {
    const adapter = makeAdapter()
    const { mock } = makePersistence()

    await runAccountSync(adapter, makeContext(), mock, noopSleep)

    expect(getDlqEntries()).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────
// runAccountSync — auth error (no retry)
// ─────────────────────────────────────────────

describe('runAccountSync — auth error', () => {
  it('returns auth_error outcome immediately (no retries)', async () => {
    const authErr = new ProviderAuthError('amex', 'token expired')
    const adapter = makeAdapter({ fetchBalance: vi.fn().mockRejectedValue(authErr) })
    const ctx = makeContext()
    const { mock } = makePersistence()

    const outcome = await runAccountSync(adapter, ctx, mock, noopSleep)

    expect(outcome.status).toBe('auth_error')
    expect(vi.mocked(adapter.fetchBalance)).toHaveBeenCalledTimes(1)
  })

  it('calls markAuthError (not markError) on ProviderAuthError', async () => {
    const adapter = makeAdapter({
      fetchBalance: vi.fn().mockRejectedValue(new ProviderAuthError('amex', 'revoked')),
    })
    const { mock } = makePersistence()

    await runAccountSync(adapter, makeContext(), mock, noopSleep)

    expect(mock.markAuthError).toHaveBeenCalledWith('acct-123')
    expect(mock.markError).not.toHaveBeenCalled()
  })

  it('does not add a DLQ entry for auth errors', async () => {
    const adapter = makeAdapter({
      fetchBalance: vi.fn().mockRejectedValue(new ProviderAuthError('amex', 'expired')),
    })
    const { mock } = makePersistence()

    await runAccountSync(adapter, makeContext(), mock, noopSleep)

    expect(getDlqEntries()).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────
// runAccountSync — transient errors (retry)
// ─────────────────────────────────────────────

describe('runAccountSync — transient error retry', () => {
  it('retries on ProviderError and succeeds on second attempt', async () => {
    const fetchBalance = vi.fn()
      .mockRejectedValueOnce(new ProviderError('amex', 'transient'))
      .mockResolvedValue(SUCCESS_RESULT)

    const adapter = makeAdapter({ fetchBalance })
    const { mock } = makePersistence()

    const outcome = await runAccountSync(adapter, makeContext(), mock, noopSleep)

    expect(outcome.status).toBe('ok')
    expect(fetchBalance).toHaveBeenCalledTimes(2)
    expect(noopSleep).toHaveBeenCalledTimes(1) // slept once between attempts
  })

  it('exhausts all attempts and returns error outcome', async () => {
    const fetchBalance = vi.fn().mockRejectedValue(new ProviderError('amex', 'always fails'))
    const adapter = makeAdapter({ fetchBalance })
    const { mock } = makePersistence()

    const outcome = await runAccountSync(adapter, makeContext(), mock, noopSleep)

    expect(outcome.status).toBe('error')
    expect(fetchBalance).toHaveBeenCalledTimes(SYNC_POLICY.maxAttempts)
  })

  it('records a DLQ entry after exhausting all retries', async () => {
    const fetchBalance = vi.fn().mockRejectedValue(new ProviderError('amex', 'boom'))
    const adapter = makeAdapter({ fetchBalance })
    const { mock } = makePersistence()

    await runAccountSync(adapter, makeContext(), mock, noopSleep)

    const entries = getDlqEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].functionId).toBe('sync-orchestrator')
    expect(entries[0].retryCount).toBe(SYNC_POLICY.maxAttempts)
  })

  it('sets errorCode = provider_error for generic ProviderError', async () => {
    const fetchBalance = vi.fn().mockRejectedValue(new ProviderError('amex', 'generic'))
    const adapter = makeAdapter({ fetchBalance })
    const { mock, calls } = makePersistence()

    await runAccountSync(adapter, makeContext(), mock, noopSleep)

    expect(calls.markError[0]).toEqual(['acct-123', 'provider_error', expect.any(String)])
  })

  it('sets errorCode = rate_limit for ProviderRateLimitError', async () => {
    const fetchBalance = vi.fn().mockRejectedValue(new ProviderRateLimitError('amex', 5000))
    const adapter = makeAdapter({ fetchBalance })
    const { mock, calls } = makePersistence()

    await runAccountSync(adapter, makeContext(), mock, noopSleep)

    expect(calls.markError[0][1]).toBe('rate_limit')
  })

  it('calls markError with accountId and message (no silent failures)', async () => {
    const fetchBalance = vi.fn().mockRejectedValue(new Error('unexpected'))
    const adapter = makeAdapter({ fetchBalance })
    const { mock } = makePersistence()

    await runAccountSync(adapter, makeContext(), mock, noopSleep)

    expect(mock.markError).toHaveBeenCalledWith(
      'acct-123',
      expect.any(String),
      expect.stringContaining('unexpected'),
    )
  })
})

// ─────────────────────────────────────────────
// runAccountSync — backoff delay verification
// ─────────────────────────────────────────────

describe('runAccountSync — backoff delays', () => {
  it('sleeps between retry attempts with increasing delays', async () => {
    const delays: number[] = []
    const recordingSleep = vi.fn().mockImplementation(async (ms: number) => {
      delays.push(ms)
    })

    const fetchBalance = vi.fn().mockRejectedValue(new ProviderError('amex', 'fail'))
    const adapter = makeAdapter({ fetchBalance })
    const { mock } = makePersistence()

    await runAccountSync(adapter, makeContext(), mock, recordingSleep)

    // With maxAttempts=3: two sleeps between attempts 1→2 and 2→3
    expect(delays).toHaveLength(SYNC_POLICY.maxAttempts - 1)

    // Each delay should be <= maxDelayMs
    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(SYNC_POLICY.maxDelayMs)
    }

    // Delays should be non-decreasing (backoff)
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
    }
  })
})
