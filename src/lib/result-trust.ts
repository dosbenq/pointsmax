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
      next_action: 'Review the top reachable option and follow the booking link or booking guide.',
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

export function buildTripBuilderTrustState(input: {
  estimatesOnly: boolean
  hasFlights: boolean
  hasBookingSteps: boolean
  aiAvailable: boolean
}): TrustState {
  if (input.hasFlights && input.aiAvailable && input.hasBookingSteps && !input.estimatesOnly) {
    return {
      availability_mode: 'live',
      confidence: 'high',
      actionability: 'high',
      next_action: 'Review the recommended plan and start the booking guide for the best flight option.',
      degraded_reason: null,
    }
  }

  if (input.hasFlights && input.estimatesOnly) {
    return {
      availability_mode: 'degraded',
      confidence: 'medium',
      actionability: input.hasBookingSteps ? 'medium' : 'low',
      next_action: input.hasBookingSteps
        ? 'Treat the plan as a modeled path and verify live availability before transferring points.'
        : 'Use the ranked flights as a shortlist, then verify live space before transferring.',
      degraded_reason: 'live_availability_unavailable',
    }
  }

  if (input.hasFlights) {
    return {
      availability_mode: 'estimated',
      confidence: 'medium',
      actionability: input.hasBookingSteps ? 'medium' : 'low',
      next_action: input.hasBookingSteps
        ? 'Follow the recommended steps and verify availability on the booking site.'
        : 'Review the ranked flight options and continue to booking only after live verification.',
      degraded_reason: input.aiAvailable ? null : 'ai_planning_unavailable',
    }
  }

  return {
    availability_mode: 'unavailable',
    confidence: 'low',
    actionability: 'low',
    next_action: 'Try another route, date range, or balance mix.',
    degraded_reason: input.aiAvailable ? 'no_results' : 'ai_planning_unavailable',
  }
}
