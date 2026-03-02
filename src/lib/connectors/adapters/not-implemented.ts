import type {
  ConnectorProvider,
  ConnectorContext,
  FetchBalanceResult,
  ProviderCapabilities,
} from '@/types/connectors'
import type { ProviderAdapter } from '../connector-interface'
import { ProviderError } from '../connector-interface'

type AdapterWithImplementedFlag = ProviderAdapter & { implemented: boolean }

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsIncrementalSync: false,
  requiresOAuth: true,
  minSyncIntervalSeconds: 4 * 60 * 60,
}

export function createNotImplementedAdapter(
  providerId: ConnectorProvider,
  displayName: string,
): AdapterWithImplementedFlag {
  return {
    providerId,
    displayName,
    capabilities: DEFAULT_CAPABILITIES,
    implemented: false,
    async fetchBalance(_unusedContext: ConnectorContext): Promise<FetchBalanceResult> {
      void _unusedContext
      throw new ProviderError(providerId, `${displayName} connector is not implemented yet`)
    },
    async validateCredentials(_unusedContext: ConnectorContext): Promise<boolean> {
      void _unusedContext
      return false
    },
  }
}
