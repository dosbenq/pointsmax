import { describe, expect, it } from 'vitest'
import { buildAwardSearchTrustState, buildTripBuilderTrustState } from './result-trust'

describe('result trust helpers', () => {
  it('marks live award-search responses as high-confidence and actionable', () => {
    expect(buildAwardSearchTrustState({
      liveAvailability: true,
      estimatesOnly: false,
      resultCount: 3,
    })).toMatchObject({
      availability_mode: 'live',
      confidence: 'high',
      actionability: 'high',
    })
  })

  it('marks provider fallback award-search responses as degraded', () => {
    expect(buildAwardSearchTrustState({
      liveAvailability: false,
      estimatesOnly: true,
      resultCount: 2,
      providerUnavailable: true,
    })).toMatchObject({
      availability_mode: 'degraded',
      degraded_reason: 'live_availability_unavailable',
    })
  })

  it('marks deterministic trip-builder fallback as degraded but actionable', () => {
    expect(buildTripBuilderTrustState({
      estimatesOnly: true,
      hasFlights: true,
      hasBookingSteps: true,
      aiAvailable: false,
    })).toMatchObject({
      availability_mode: 'degraded',
      actionability: 'medium',
    })
  })
})
