import { describe, it, expect, beforeEach } from 'vitest'
import {
  ConnectorRegistry,
  assertAdapterContract,
  AdapterContractError,
  UnregisteredProviderError,
} from './connector-registry'
import type { ProviderAdapter } from './connector-interface'
import type { ConnectorContext, FetchBalanceResult } from '@/types/connectors'

// ─────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────

function makeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    providerId: 'amex',
    displayName: 'American Express',
    capabilities: {
      supportsIncrementalSync: false,
      requiresOAuth: true,
      minSyncIntervalSeconds: 3600,
    },
    fetchBalance: async (): Promise<FetchBalanceResult> => ({
      balances: { 'prog-amex-mr': 50_000 },
      cursor: null,
    }),
    validateCredentials: async (): Promise<boolean> => true,
    ...overrides,
  }
}

// ─────────────────────────────────────────────
// ConnectorRegistry
// ─────────────────────────────────────────────

describe('ConnectorRegistry', () => {
  let registry: ConnectorRegistry

  beforeEach(() => {
    registry = new ConnectorRegistry()
  })

  describe('register / get / isSupported', () => {
    it('registers an adapter and retrieves it by provider', () => {
      const adapter = makeAdapter()
      registry.register(adapter)
      expect(registry.get('amex')).toBe(adapter)
    })

    it('returns undefined for an unknown provider', () => {
      expect(registry.get('chase')).toBeUndefined()
    })

    it('isSupported returns true after registration', () => {
      registry.register(makeAdapter())
      expect(registry.isSupported('amex')).toBe(true)
    })

    it('isSupported returns false for unregistered provider', () => {
      expect(registry.isSupported('citi')).toBe(false)
    })

    it('overwrites a previously registered adapter', () => {
      const first = makeAdapter({ displayName: 'First' })
      const second = makeAdapter({ displayName: 'Second' })
      registry.register(first)
      registry.register(second)
      expect(registry.get('amex')?.displayName).toBe('Second')
    })
  })

  describe('getOrThrow', () => {
    it('returns the adapter when registered', () => {
      const adapter = makeAdapter()
      registry.register(adapter)
      expect(registry.getOrThrow('amex')).toBe(adapter)
    })

    it('throws UnregisteredProviderError for unknown provider', () => {
      expect(() => registry.getOrThrow('chase')).toThrow(UnregisteredProviderError)
    })

    it('includes the provider name in the error message', () => {
      expect(() => registry.getOrThrow('bilt')).toThrow(/bilt/)
    })
  })

  describe('list', () => {
    it('returns an empty list when no adapters are registered', () => {
      expect(registry.list()).toEqual([])
    })

    it('lists all registered providers', () => {
      registry.register(makeAdapter({ providerId: 'amex' }))
      registry.register(makeAdapter({ providerId: 'chase' }))
      expect(registry.list()).toHaveLength(2)
      expect(registry.list()).toContain('amex')
      expect(registry.list()).toContain('chase')
    })
  })

  describe('size', () => {
    it('reports 0 initially', () => {
      expect(registry.size).toBe(0)
    })

    it('increments with each unique registration', () => {
      registry.register(makeAdapter({ providerId: 'amex' }))
      registry.register(makeAdapter({ providerId: 'chase' }))
      expect(registry.size).toBe(2)
    })

    it('stays the same when re-registering the same provider', () => {
      registry.register(makeAdapter())
      registry.register(makeAdapter({ displayName: 'Updated' }))
      expect(registry.size).toBe(1)
    })
  })

  describe('validateAdapter', () => {
    it('does not throw for a valid adapter', () => {
      expect(() => registry.validateAdapter(makeAdapter())).not.toThrow()
    })

    it('throws AdapterContractError for an invalid adapter', () => {
      expect(() => registry.validateAdapter({} as ProviderAdapter)).toThrow(AdapterContractError)
    })
  })
})

// ─────────────────────────────────────────────
// assertAdapterContract
// ─────────────────────────────────────────────

describe('assertAdapterContract', () => {
  it('passes a fully valid adapter', () => {
    expect(() => assertAdapterContract(makeAdapter())).not.toThrow()
  })

  it('rejects null', () => {
    expect(() => assertAdapterContract(null)).toThrow(AdapterContractError)
  })

  it('rejects non-object', () => {
    expect(() => assertAdapterContract('not an adapter')).toThrow(AdapterContractError)
  })

  it('rejects adapter with missing providerId', () => {
    const bad = makeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(bad as any).providerId = ''
    expect(() => assertAdapterContract(bad)).toThrow(/providerId/)
  })

  it('rejects adapter with missing displayName', () => {
    const bad = makeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(bad as any).displayName = ''
    expect(() => assertAdapterContract(bad)).toThrow(/displayName/)
  })

  it('rejects adapter without capabilities object', () => {
    const bad = makeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(bad as any).capabilities = null
    expect(() => assertAdapterContract(bad)).toThrow(/capabilities/)
  })

  it('rejects adapter with non-boolean supportsIncrementalSync', () => {
    const bad = makeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(bad as any).capabilities.supportsIncrementalSync = 'yes'
    expect(() => assertAdapterContract(bad)).toThrow(/supportsIncrementalSync/)
  })

  it('rejects adapter with non-boolean requiresOAuth', () => {
    const bad = makeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(bad as any).capabilities.requiresOAuth = 1
    expect(() => assertAdapterContract(bad)).toThrow(/requiresOAuth/)
  })

  it('rejects adapter with negative minSyncIntervalSeconds', () => {
    const bad = makeAdapter()
    bad.capabilities.minSyncIntervalSeconds = -1
    expect(() => assertAdapterContract(bad)).toThrow(/minSyncIntervalSeconds/)
  })

  it('rejects adapter with non-function fetchBalance', () => {
    const bad = makeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(bad as any).fetchBalance = 'not a function'
    expect(() => assertAdapterContract(bad)).toThrow(/fetchBalance/)
  })

  it('rejects adapter with non-function validateCredentials', () => {
    const bad = makeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(bad as any).validateCredentials = undefined
    expect(() => assertAdapterContract(bad)).toThrow(/validateCredentials/)
  })

  it('accumulates multiple violations in the error message', () => {
    const bad = {
      providerId: '',
      displayName: '',
      capabilities: {},
      fetchBalance: null,
      validateCredentials: null,
    }
    let err: AdapterContractError | null = null
    try {
      assertAdapterContract(bad)
    } catch (e) {
      err = e as AdapterContractError
    }
    expect(err).toBeInstanceOf(AdapterContractError)
    expect(err!.violations.length).toBeGreaterThan(1)
  })
})

// ─────────────────────────────────────────────
// Integration: register → fetch
// ─────────────────────────────────────────────

describe('adapter fetchBalance contract', () => {
  it('returns balances map and nullable cursor', async () => {
    const adapter = makeAdapter()
    const registry = new ConnectorRegistry()
    registry.register(adapter)

    const ctx = {
      accessToken: 'tok_test',
      userId: 'user-123',
      account: {} as never,
    } satisfies ConnectorContext

    const result = await registry.getOrThrow('amex').fetchBalance(ctx)
    expect(result.balances).toBeDefined()
    expect(typeof result.balances).toBe('object')
    expect('cursor' in result).toBe(true)
  })
})
