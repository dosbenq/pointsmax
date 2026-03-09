import type { AwardSearchResult } from './types'

function compareAwardResults(a: AwardSearchResult, b: AwardSearchResult): number {
  if (a.is_reachable !== b.is_reachable) {
    return a.is_reachable ? -1 : 1
  }
  if (a.points_needed_from_wallet !== b.points_needed_from_wallet) {
    return a.points_needed_from_wallet - b.points_needed_from_wallet
  }
  if (a.cpp_cents !== b.cpp_cents) {
    return b.cpp_cents - a.cpp_cents
  }
  if (a.has_real_availability !== b.has_real_availability) {
    return a.has_real_availability ? -1 : 1
  }
  return a.estimated_miles - b.estimated_miles
}

export function sortAwardResultsByPoints(results: AwardSearchResult[]): AwardSearchResult[] {
  return [...results].sort(compareAwardResults)
}
