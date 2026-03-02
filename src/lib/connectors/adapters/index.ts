import { connectorRegistry } from '../connector-registry'
import type { ConnectorProvider } from '@/types/connectors'
import { createNotImplementedAdapter } from './not-implemented'

const BUILTIN_PROVIDER_LABELS: Record<ConnectorProvider, string> = {
  amex: 'American Express',
  chase: 'Chase',
  citi: 'Citi',
  bilt: 'Bilt',
  capital_one: 'Capital One',
  wells_fargo: 'Wells Fargo',
  bank_of_america: 'Bank of America',
  us_bank: 'US Bank',
  discover: 'Discover',
  barclays: 'Barclays',
}

let initialized = false

export function ensureConnectorRegistryInitialized(): void {
  if (initialized) return
  initialized = true

  for (const provider of Object.keys(BUILTIN_PROVIDER_LABELS) as ConnectorProvider[]) {
    if (connectorRegistry.get(provider)) continue
    connectorRegistry.register(
      createNotImplementedAdapter(provider, BUILTIN_PROVIDER_LABELS[provider]),
    )
  }
}

