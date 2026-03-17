import type { AwardSearchResult } from '@/lib/award-search/types'

export type DealScore = {
  rating: 'exceptional' | 'good' | 'fair' | 'poor'
  cpp_cents: number
  vs_static_baseline_pct: number
  headline: string
}

export function scoreDeal(result: AwardSearchResult, staticBaselineCppCents: number): DealScore {
  const cpp = Number(result.cpp_cents) || 0
  const baseline = Number(staticBaselineCppCents) || 0
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
