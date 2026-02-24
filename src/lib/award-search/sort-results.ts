import type { AwardSearchResult } from './types'

function compareAwardResults(a: AwardSearchResult, b: AwardSearchResult): number {
  if (a.points_needed_from_wallet !== b.points_needed_from_wallet) {
    return a.points_needed_from_wallet - b.points_needed_from_wallet
  }
  if (a.is_reachable !== b.is_reachable) {
    return a.is_reachable ? -1 : 1
  }
  if (a.has_real_availability !== b.has_real_availability) {
    return a.has_real_availability ? -1 : 1
  }
  if (a.estimated_miles !== b.estimated_miles) {
    return a.estimated_miles - b.estimated_miles
  }
  return b.estimated_cash_value_cents - a.estimated_cash_value_cents
}

export function sortAwardResultsByPoints(results: AwardSearchResult[]): AwardSearchResult[] {
  return [...results].sort(compareAwardResults)
}
