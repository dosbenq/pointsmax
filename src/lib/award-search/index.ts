// ============================================================
// Award Search — Factory
// Returns SeatsAeroProvider if SEATS_AERO_API_KEY is set,
// otherwise falls back to StubProvider (free static estimates).
// ============================================================

import type { AwardProvider } from './types'
import { StubProvider } from './stub-provider'
import { SeatsAeroProvider } from './seats-aero-provider'

export function createAwardProvider(): AwardProvider {
  const key = process.env.SEATS_AERO_API_KEY
  if (key?.trim()) {
    return new SeatsAeroProvider(key.trim())
  }
  return new StubProvider()
}

export type { AwardProvider, AwardSearchParams, AwardSearchResult, AwardSearchResponse, AwardNarrative, CabinClass } from './types'
