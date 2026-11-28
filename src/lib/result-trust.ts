export type AvailabilityMode = 'live' | 'estimated' | 'degraded' | 'unavailable'
export type ResultConfidence = 'high' | 'medium' | 'low'
export type ActionabilityLevel = 'high' | 'medium' | 'low'

export type TrustState = {
  availability_mode: AvailabilityMode
  confidence: ResultConfidence
  actionability: ActionabilityLevel
  next_action: string
  degraded_reason: string | null
}

export function buildAwardSearchTrustState(input: {
  liveAvailability: boolean
  estimatesOnly: boolean
  resultCount: number
  providerUnavailable?: boolean
}): TrustState {
  if (input.liveAvailability && input.resultCount > 0) {
    return {
      availability_mode: 'live',
      confidence: 'high',
      actionability: 'high',
      next_action: 'Review the top reachable option and follow the booking link.',
      degraded_reason: null,
    }
  }

  if (input.providerUnavailable) {
    return {
      availability_mode: 'degraded',
      confidence: 'medium',
      actionability: input.resultCount > 0 ? 'medium' : 'low',
      next_action: input.resultCount > 0
        ? 'Use the modeled options as a shortlist, then verify live space before transferring points.'
        : 'Try a different route or date range while live availability is unavailable.',
      degraded_reason: 'live_availability_unavailable',
    }
  }

  if (input.estimatesOnly) {
    return {
      availability_mode: 'estimated',
      confidence: 'medium',
      actionability: input.resultCount > 0 ? 'medium' : 'low',
      next_action: input.resultCount > 0
        ? 'Use the modeled options as a planning guide and verify live space before transferring.'
        : 'Adjust your route, dates, or balances to explore more modeled options.',
      degraded_reason: null,
    }
  }

  return {
    availability_mode: 'unavailable',
    confidence: 'low',
    actionability: 'low',
    next_action: 'Try again later or adjust the route and date range.',
    degraded_reason: 'no_results',
  }
}
