// ============================================================
// Award Search — Factory
// Uses Seats.aero when configured.
// Stub fallback is only allowed in non-production unless explicitly enabled.
// ============================================================

import type { AwardProvider } from './types'
import { StubProvider } from './stub-provider'
import { SeatsAeroProvider } from './seats-aero-provider'

export class AwardProviderUnavailableError extends Error {
  constructor(message = 'Live award data is not configured. Add SEATS_AERO_API_KEY.') {
    super(message)
    this.name = 'AwardProviderUnavailableError'
  }
}

function shouldAllowStubFallback(): boolean {
  const explicit = (process.env.ALLOW_STUB_AWARD_SEARCH ?? '').trim().toLowerCase()
  if (explicit === '1' || explicit === 'true' || explicit === 'yes') return true
  if (explicit === '0' || explicit === 'false' || explicit === 'no') return false
  return process.env.NODE_ENV !== 'production'
}

export function createAwardProvider(): AwardProvider {
  const key = process.env.SEATS_AERO_API_KEY
  if (key?.trim()) {
    return new SeatsAeroProvider(key.trim())
  }

  if (shouldAllowStubFallback()) {
    return new StubProvider()
  }

  throw new AwardProviderUnavailableError()
}

export type { AwardProvider, AwardSearchParams, AwardSearchResult, AwardSearchResponse, AwardNarrative, CabinClass } from './types'
