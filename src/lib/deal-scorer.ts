import type { AwardSearchResult } from '@/lib/award-search/types'

export type DealScore = {
  rating: 'exceptional' | 'good' | 'fair' | 'poor'
  cpp_cents: number
  vs_static_baseline_pct: number
  headline: string
}

const BASELINE_CPP_BY_TYPE: Record<string, number> = {
  airline_miles: 1.4,
  hotel_points: 0.7,
  transferable_points: 1.8,
  cashback: 1.0,
  default: 1.2,
}

function getBaselineCpp(programType?: string): number {
  return BASELINE_CPP_BY_TYPE[programType ?? 'default'] ?? BASELINE_CPP_BY_TYPE.default
}

export function scoreDeal(result: AwardSearchResult, staticBaselineCppCents: number, programType?: string): DealScore {
  const cpp = Number(result.cpp_cents) || 0
  const baseline = staticBaselineCppCents > 0 ? Number(staticBaselineCppCents) : getBaselineCpp(programType)
  const vsStaticBaselinePct = baseline > 0
    ? Math.round((cpp / baseline) * 100)
    : 0

  let rating: DealScore['rating'] = 'poor'
  if (vsStaticBaselinePct >= 300) {
    rating = 'exceptional'
  } else if (vsStaticBaselinePct >= 150) {
    rating = 'good'
  } else if (vsStaticBaselinePct >= 100) {
    rating = 'fair'
  }

  const multiplier = baseline > 0 ? `${(cpp / baseline).toFixed(1)}x typical value` : 'above baseline'
  const headline = `${result.program_name} award — ${cpp.toFixed(1)}¢/pt (${multiplier})`

  return {
    rating,
    cpp_cents: cpp,
    vs_static_baseline_pct: vsStaticBaselinePct,
    headline,
  }
}
