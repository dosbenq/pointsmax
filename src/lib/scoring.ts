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
  from_program?: {
    id?: string
  }
}

function groupKey(row: TotalsRow, index: number): string {
  return row.from_program_id ?? row.from_program?.id ?? row.program_id ?? `row-${index}`
}

function pickBestValue(rows: TotalsRow[]): number {
  if (rows.length === 0) return 0
  const candidates = rows.filter((row) => row.is_best)
  const source = candidates.length > 0 ? candidates : rows
  return source.reduce((best, row) => {
    const value = Number.isFinite(row.total_value_cents) ? row.total_value_cents : 0
    return Math.max(best, value)
  }, 0)
}

export function calculateTotals(results: TotalsRow[]): {
  totalOptimalCents: number
  totalCashCents: number
} {
  if (!Array.isArray(results)) {
    return { totalOptimalCents: 0, totalCashCents: 0 }
  }

  const grouped = new Map<string, TotalsRow[]>()
  results.forEach((row, index) => {
    const key = groupKey(row, index)
    const list = grouped.get(key) ?? []
    list.push(row)
    grouped.set(key, list)
  })

  let totalOptimalCents = 0
  let totalCashCents = 0

  for (const rows of grouped.values()) {
    const cashRows = rows.filter((row) => row.category === 'statement_credit' || row.category === 'cashback')
    const nonCashRows = rows.filter((row) => row.category !== 'statement_credit' && row.category !== 'cashback')
    totalOptimalCents += pickBestValue(nonCashRows.length > 0 ? nonCashRows : cashRows)
    totalCashCents += pickBestValue(cashRows)
  }
  
  return { totalOptimalCents, totalCashCents }
}
