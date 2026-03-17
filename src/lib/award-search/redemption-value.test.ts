import { describe, expect, it } from 'vitest'
import { estimateAwardCashValue } from './redemption-value'

describe('estimateAwardCashValue', () => {
  it('returns a modeled route fare with medium confidence when availability is real', () => {
    const result = estimateAwardCashValue({
      routeRegion: 'europe',
      cabin: 'business',
      passengers: 1,
      estimatedMiles: 55000,
      hasRealAvailability: true,
    })

    expect(result).toEqual({
      cashValueCents: 280000,
      cppCents: 280000 / 55000,
      source: 'modeled_route_fare',
      confidence: 'medium',
    })
  })

  it('scales with passenger count and falls back to low confidence without live availability', () => {
    const result = estimateAwardCashValue({
      routeRegion: 'domestic_india',
      cabin: 'economy',
      passengers: 2,
      estimatedMiles: 12000,
      hasRealAvailability: false,
    })

    expect(result).toEqual({
      cashValueCents: 19000,
      cppCents: 19000 / 12000,
      source: 'modeled_route_fare',
      confidence: 'low',
    })
  })

  it('returns null when estimated miles are invalid', () => {
    expect(estimateAwardCashValue({
      routeRegion: 'europe',
      cabin: 'business',
      passengers: 1,
      estimatedMiles: 0,
      hasRealAvailability: true,
    })).toBeNull()
  })
})
