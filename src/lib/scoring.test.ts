// ============================================================
// Scoring Tests — Sprint 19
// Pure function tests for value scoring calculations
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  calculateValueScore,
  calculateValueGapPercent,
  calculateEffectiveCpp,
  rankResults,
  calculateTotals,
} from './scoring'

describe('scoring', () => {
  describe('calculateValueScore', () => {
    it('calculates score relative to baseline', () => {
      expect(calculateValueScore(2.0, 1.0)).toBe(100) // 2x baseline = 100
      expect(calculateValueScore(1.0, 1.0)).toBe(50)  // 1x baseline = 50
      expect(calculateValueScore(1.5, 1.0)).toBe(75)  // 1.5x baseline = 75
    })

    it('caps at 100', () => {
      expect(calculateValueScore(5.0, 1.0)).toBe(100)
    })

    it('handles invalid inputs', () => {
      expect(calculateValueScore(0, 1.0)).toBe(0)
      expect(calculateValueScore(-1, 1.0)).toBe(0)
      expect(calculateValueScore(2.0, 0)).toBe(0)
      expect(calculateValueScore(NaN, 1.0)).toBe(0)
    })
  })

  describe('calculateValueGapPercent', () => {
    it('calculates gap percentage', () => {
      expect(calculateValueGapPercent(150, 100)).toBe(50) // 50% more
      expect(calculateValueGapPercent(200, 100)).toBe(100) // 100% more
      expect(calculateValueGapPercent(100, 100)).toBe(0)   // no gap
    })

    it('returns 0 when optimal <= cash', () => {
      expect(calculateValueGapPercent(80, 100)).toBe(0)
      expect(calculateValueGapPercent(100, 100)).toBe(0)
    })

    it('handles invalid inputs', () => {
      expect(calculateValueGapPercent(100, 0)).toBe(0)
      expect(calculateValueGapPercent(NaN, 100)).toBe(0)
    })
  })

  describe('calculateEffectiveCpp', () => {
    it('calculates CPP with bonus', () => {
      expect(calculateEffectiveCpp(2.0, 30)).toBe(2.6) // 2.0 * 1.3
      expect(calculateEffectiveCpp(1.5, 0)).toBe(1.5) // no bonus
      expect(calculateEffectiveCpp(1.5, 100)).toBe(3.0) // 2x bonus
    })

    it('returns base CPP when no bonus', () => {
      expect(calculateEffectiveCpp(2.0, 0)).toBe(2.0)
      expect(calculateEffectiveCpp(2.0, -10)).toBe(2.0) // negative bonus ignored
    })

    it('handles invalid inputs', () => {
      expect(calculateEffectiveCpp(0, 30)).toBe(0)
      expect(calculateEffectiveCpp(-1, 30)).toBe(0)
    })
  })

  describe('rankResults', () => {
    it('sorts by total value descending', () => {
      const results = [
        { total_value_cents: 5000, cpp_cents: 2.0 },
        { total_value_cents: 10000, cpp_cents: 1.5 },
        { total_value_cents: 7500, cpp_cents: 1.8 },
      ]
      const ranked = rankResults(results)
      expect(ranked[0].total_value_cents).toBe(10000)
      expect(ranked[1].total_value_cents).toBe(7500)
      expect(ranked[2].total_value_cents).toBe(5000)
    })

    it('marks first result as best', () => {
      const results = [
        { total_value_cents: 5000, cpp_cents: 2.0 },
        { total_value_cents: 10000, cpp_cents: 1.5 },
      ]
      const ranked = rankResults(results)
      expect(ranked[0].is_best).toBe(true)
      expect(ranked[1].is_best).toBe(false)
    })

    it('uses CPP as tiebreaker', () => {
      const results = [
        { total_value_cents: 10000, cpp_cents: 1.5 },
        { total_value_cents: 10000, cpp_cents: 2.0 },
      ]
      const ranked = rankResults(results)
      expect(ranked[0].cpp_cents).toBe(2.0)
      expect(ranked[0].is_best).toBe(true)
    })

    it('handles empty array', () => {
      expect(rankResults([])).toEqual([])
    })
  })

  describe('calculateTotals', () => {
    it('uses only the best non-cash result per program', () => {
      const results = [
        { total_value_cents: 10000, category: 'transfer_partner', from_program_id: 'a', is_best: true },
        { total_value_cents: 5000, category: 'travel_portal', from_program_id: 'a', is_best: false },
        { total_value_cents: 9000, category: 'transfer_partner', from_program_id: 'b', is_best: true },
        { total_value_cents: 2000, category: 'statement_credit', from_program_id: 'a' },
        { total_value_cents: 1000, category: 'cashback', from_program_id: 'a' },
        { total_value_cents: 2500, category: 'statement_credit', from_program_id: 'b' },
      ]
      const totals = calculateTotals(results)
      expect(totals.totalOptimalCents).toBe(19000)
      expect(totals.totalCashCents).toBe(4500)
    })

    it('falls back to the best value per grouped program when is_best is missing', () => {
      const results = [
        { total_value_cents: 10000, category: 'transfer_partner', from_program_id: 'a' },
        { total_value_cents: 5000, category: 'travel_portal', from_program_id: 'a' },
        { total_value_cents: 7000, category: 'transfer_partner', from_program_id: 'b' },
        { total_value_cents: 4000, category: 'travel_portal', from_program_id: 'b' },
      ]
      const totals = calculateTotals(results)
      expect(totals.totalOptimalCents).toBe(17000)
    })

    it('handles empty array', () => {
      const totals = calculateTotals([])
      expect(totals.totalOptimalCents).toBe(0)
      expect(totals.totalCashCents).toBe(0)
    })

    it('handles invalid inputs gracefully', () => {
      expect(calculateTotals(null as unknown as [])).toEqual({ totalOptimalCents: 0, totalCashCents: 0 })
      expect(calculateTotals(undefined as unknown as [])).toEqual({ totalOptimalCents: 0, totalCashCents: 0 })
    })

    it('groups real RedemptionResult rows by nested from_program.id', () => {
      const totals = calculateTotals([
        { total_value_cents: 9000, category: 'transfer_partner', from_program: { id: 'a' }, is_best: true },
        { total_value_cents: 8000, category: 'travel_portal', from_program: { id: 'a' }, is_best: true },
      ])

      expect(totals.totalOptimalCents).toBe(9000)
    })

    it('uses cashback rows as optimal when a program has no non-cash options', () => {
      const totals = calculateTotals([
        { total_value_cents: 4000, category: 'cashback', from_program: { id: 'cash-only' }, is_best: true },
      ])

      expect(totals.totalOptimalCents).toBe(4000)
      expect(totals.totalCashCents).toBe(4000)
    })
  })
})
