// ============================================================
// Scoring — Sprint 19
// Pure calculation functions for value scoring
// Extracted from calculator for testability
// ============================================================

/**
 * Calculate value score (0-100) based on CPP relative to baseline
 * Higher CPP = higher score
 */
export function calculateValueScore(cppCents: number, baselineCpp: number = 1.0): number {
  if (!Number.isFinite(cppCents) || cppCents <= 0) return 0
  if (!Number.isFinite(baselineCpp) || baselineCpp <= 0) return 0
  
  const ratio = cppCents / baselineCpp
  // Score formula: ratio * 50 (so 2x baseline = 100)
  const score = Math.min(100, Math.round(ratio * 50))
  return score
}

/**
 * Calculate value left on table percentage
 */
export function calculateValueGapPercent(optimal: number, cash: number): number {
  if (!Number.isFinite(optimal) || !Number.isFinite(cash) || cash <= 0) return 0
  const gap = optimal - cash
  if (gap <= 0) return 0
  return Math.round((gap / cash) * 100)
}

/**
 * Calculate effective CPP after transfer bonus
 */
export function calculateEffectiveCpp(baseCpp: number, bonusPct: number): number {
  if (!Number.isFinite(baseCpp) || baseCpp <= 0) return 0
  if (!Number.isFinite(bonusPct) || bonusPct < 0) return baseCpp
  return baseCpp * (1 + bonusPct / 100)
}

/**
 * Rank results by total value (descending)
 * Returns sorted copy with is_best flag set
 */
export interface RankableResult {
  total_value_cents: number
  cpp_cents: number
  is_best?: boolean
}

export function rankResults<T extends RankableResult>(results: T[]): T[] {
  if (!Array.isArray(results) || results.length === 0) return []
  
  const sorted = [...results].sort((a, b) => {
    // Primary: total value
    if (b.total_value_cents !== a.total_value_cents) {
      return b.total_value_cents - a.total_value_cents
    }
    // Tiebreaker: CPP
    return b.cpp_cents - a.cpp_cents
  })
  
  // Mark best result
  return sorted.map((r, i) => ({
    ...r,
    is_best: i === 0,
  }))
}

/**
 * Calculate total optimal and cash values from results
 */
type TotalsRow = {
  total_value_cents: number
  category: string
  is_best?: boolean
  program_id?: string
  from_program_id?: string
}

function groupKey(row: TotalsRow, index: number): string {
  return row.from_program_id ?? row.program_id ?? `row-${index}`
}

function sumBestPerGroup(results: TotalsRow[]): number {
  if (results.length === 0) return 0

  const flagged = results.filter((row) => row.is_best)
  if (flagged.length > 0) {
    return flagged.reduce((sum, row) => sum + (Number.isFinite(row.total_value_cents) ? row.total_value_cents : 0), 0)
  }

  const bestByGroup = new Map<string, number>()
  results.forEach((row, index) => {
    const key = groupKey(row, index)
    const value = Number.isFinite(row.total_value_cents) ? row.total_value_cents : 0
    const current = bestByGroup.get(key) ?? Number.NEGATIVE_INFINITY
    if (value > current) {
      bestByGroup.set(key, value)
    }
  })

  return [...bestByGroup.values()].reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
}

export function calculateTotals(results: TotalsRow[]): {
  totalOptimalCents: number
  totalCashCents: number
} {
  if (!Array.isArray(results)) {
    return { totalOptimalCents: 0, totalCashCents: 0 }
  }
  
  const totalOptimalCents = sumBestPerGroup(
    results.filter(r => r.category !== 'statement_credit' && r.category !== 'cashback')
  )

  const totalCashCents = sumBestPerGroup(
    results.filter(r => r.category === 'statement_credit' || r.category === 'cashback')
  )
  
  return { totalOptimalCents, totalCashCents }
}
