// ============================================================
// PointsMax — Connector Registry
//
// Central registry for all ProviderAdapter implementations.
// Adapters are registered at module initialisation time and
// looked up by provider slug at runtime.
//
// Usage:
//   import { connectorRegistry } from '@/lib/connectors/connector-registry'
//   const adapter = connectorRegistry.getOrThrow('amex')
//   const result  = await adapter.fetchBalance(ctx)
// ============================================================

import type { ConnectorProvider } from '@/types/connectors'
import type { ProviderAdapter } from './connector-interface'
import { logInfo } from '@/lib/logger'

// ─────────────────────────────────────────────
// REGISTRY CLASS
// ─────────────────────────────────────────────

export class ConnectorRegistry {
  private readonly adapters = new Map<ConnectorProvider, ProviderAdapter>()

  /**
   * Register a provider adapter.
   * Re-registering the same provider overwrites the previous entry
   * (allows hot-reload in dev / test override patterns).
   */
  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter)
    logInfo('connector_registered', { provider: adapter.providerId })
  }

  /**
   * Retrieve the adapter for a provider, or undefined if not registered.
   */
  get(provider: ConnectorProvider): ProviderAdapter | undefined {
    return this.adapters.get(provider)
  }

  /**
   * Retrieve the adapter for a provider, throwing if it is not registered.
   */
  getOrThrow(provider: ConnectorProvider): ProviderAdapter {
    const adapter = this.adapters.get(provider)
    if (!adapter) {
      throw new UnregisteredProviderError(provider)
    }
    return adapter
  }

  /**
   * Returns a list of all currently registered provider slugs.
   */
  list(): ConnectorProvider[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Returns true if the provider has a registered adapter.
   */
  isSupported(provider: string): provider is ConnectorProvider {
    return this.adapters.has(provider as ConnectorProvider)
  }

  /**
   * Validates that the adapter satisfies the ProviderAdapter contract
   * at registration time.  Throws if the adapter is malformed.
   *
   * Call this in tests or CI to assert that every registered adapter
   * fulfils the required interface shape.
   */
  validateAdapter(adapter: ProviderAdapter): void {
    assertAdapterContract(adapter)
  }

  /** Returns the number of registered adapters. */
  get size(): number {
    return this.adapters.size
  }
}

// ─────────────────────────────────────────────
// CONTRACT VALIDATION
// ─────────────────────────────────────────────

/**
 * Asserts that an object satisfies the ProviderAdapter contract.
 * Throws a descriptive error for every violation found.
 */
export function assertAdapterContract(adapter: unknown): asserts adapter is ProviderAdapter {
  const violations: string[] = []
  const a = adapter as Record<string, unknown>

  if (!a || typeof a !== 'object') {
    throw new AdapterContractError('adapter', ['adapter must be an object'])
  }

  if (typeof a.providerId !== 'string' || a.providerId.trim() === '') {
    violations.push('providerId must be a non-empty string')
  }
  if (typeof a.displayName !== 'string' || a.displayName.trim() === '') {
    violations.push('displayName must be a non-empty string')
  }
  if (!a.capabilities || typeof a.capabilities !== 'object') {
    violations.push('capabilities must be an object')
  } else {
    const caps = a.capabilities as Record<string, unknown>
    if (typeof caps.supportsIncrementalSync !== 'boolean') {
      violations.push('capabilities.supportsIncrementalSync must be a boolean')
    }
    if (typeof caps.requiresOAuth !== 'boolean') {
      violations.push('capabilities.requiresOAuth must be a boolean')
    }
    if (typeof caps.minSyncIntervalSeconds !== 'number' || caps.minSyncIntervalSeconds < 0) {
      violations.push('capabilities.minSyncIntervalSeconds must be a non-negative number')
    }
  }
  if (typeof a.fetchBalance !== 'function') {
    violations.push('fetchBalance must be a function')
  }
  if (typeof a.validateCredentials !== 'function') {
    violations.push('validateCredentials must be a function')
  }

  if (violations.length > 0) {
    throw new AdapterContractError(String(a.providerId ?? 'unknown'), violations)
  }
}

// ─────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────

export class UnregisteredProviderError extends Error {
  constructor(public readonly provider: string) {
    super(`No adapter registered for provider: "${provider}"`)
    this.name = 'UnregisteredProviderError'
  }
}

export class AdapterContractError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly violations: string[],
  ) {
    super(
      `ProviderAdapter contract violations for "${providerId}":\n` +
        violations.map((v) => `  • ${v}`).join('\n'),
    )
    this.name = 'AdapterContractError'
  }
}

// ─────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────

/**
 * Application-wide connector registry singleton.
 * Adapters are registered in src/lib/connectors/adapters/index.ts.
 */
export const connectorRegistry = new ConnectorRegistry()
