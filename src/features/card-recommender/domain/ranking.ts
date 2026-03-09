import type { CardWithRates, SpendCategory } from '@/types/database'
import type { Region } from '@/lib/regions'
import { yearlyPointsFromSpend, getCategoriesForRegion } from '@/lib/card-tools'
import { getCardAnnualFeeAmount } from './metadata'
import type { SpendOnlyResult, RankingOptions, CardRecommendation } from './types'

/**
 * Calculate spend-only results for the earnings view
 * Ranks cards purely by spend-based net value without goal matching or scoring
 */
export function calculateSpendOnlyRanking(
  cards: CardWithRates[],
  spend: Partial<Record<SpendCategory, string>>,
  regionCode: Region,
  options?: RankingOptions
): SpendOnlyResult[] {
  const categories = getCategoriesForRegion(regionCode)
  
  const results = cards.map((card): SpendOnlyResult => {
    const pointsPerYear = categories.reduce((sum, { key }) => {
      const monthly = Number.parseFloat((spend[key] ?? '0').replace(/,/g, '')) || 0
      const multiplier = key === 'shopping'
        ? (card.earning_rates.shopping ?? card.earning_rates.other ?? 1)
        : (card.earning_rates[key] ?? card.earning_rates.other ?? 1)
      return sum + yearlyPointsFromSpend({
        monthlySpend: monthly,
        earnMultiplier: multiplier,
        earnUnit: card.earn_unit,
      })
    }, 0)
    const annualValue = (pointsPerYear * card.cpp_cents) / 100
    const netValue = annualValue - getCardAnnualFeeAmount(card)
    return { card, pointsPerYear, annualValue, netValue }
  })

  // Sort by net value descending
  const sorted = results.sort((a, b) => b.netValue - a.netValue)

  // Apply limit if specified
  const limit = options?.limit
  if (limit && limit > 0) {
    return sorted.slice(0, limit)
  }

  return sorted
}

/**
 * Filter recommendations to only include eligible cards
 */
export function filterEligibleRecommendations(
  recommendations: CardRecommendation[]
): CardRecommendation[] {
  return recommendations.filter(result => result.status !== 'ineligible')
}

/**
 * Filter recommendations to only include ineligible/blocked cards
 */
export function filterIneligibleRecommendations(
  recommendations: CardRecommendation[]
): CardRecommendation[] {
  return recommendations.filter(result => result.status === 'ineligible')
}

/**
 * Split recommendations into visible and blocked lists
 */
export function splitRecommendationsByStatus(
  recommendations: CardRecommendation[]
): {
  visible: CardRecommendation[]
  blocked: CardRecommendation[]
} {
  return {
    visible: filterEligibleRecommendations(recommendations),
    blocked: filterIneligibleRecommendations(recommendations),
  }
}

/**
 * Get top N recommendations
 */
export function getTopRecommendations(
  recommendations: CardRecommendation[],
  count: number
): CardRecommendation[] {
  return recommendations.slice(0, count)
}

/**
 * Get recommendation by card ID
 */
export function getRecommendationByCardId(
  recommendations: CardRecommendation[],
  cardId: string
): CardRecommendation | undefined {
  return recommendations.find(r => r.card.id === cardId)
}

/**
 * Check if any recommendations are available
 */
export function hasRecommendations(
  recommendations: CardRecommendation[]
): boolean {
  return recommendations.length > 0 &&
    recommendations.some(r => r.status !== 'ineligible')
}

/**
 * Get count of eligible recommendations
 */
export function getEligibleCount(
  recommendations: CardRecommendation[]
): number {
  return recommendations.filter(r => r.status !== 'ineligible').length
}

/**
 * Get count of ineligible recommendations
 */
export function getIneligibleCount(
  recommendations: CardRecommendation[]
): number {
  return recommendations.filter(r => r.status === 'ineligible').length
}
