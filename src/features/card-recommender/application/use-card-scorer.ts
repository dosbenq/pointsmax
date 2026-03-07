'use client'

import { useMemo } from 'react'
import type { CardWithRates } from '@/types/database'
import type { Region } from '@/lib/regions'
import {
  scoreAndRankCards,
  type CardRecommendation,
  type AnnualFeeTolerance,
  type RecommendationMode,
  type WalletBalanceInput,
  TRAVEL_GOALS,
} from '../domain'

export type { CardRecommendation }
export { TRAVEL_GOALS }

export interface UseCardScorerInputs {
  cards: CardWithRates[]
  spend: Partial<Record<string, string>>
  travelGoals: Set<string>
  ownedCards: Set<string>
  regionCode: Region
  programGoalMap: Record<string, string[]>
  annualFeeTolerance: AnnualFeeTolerance
  mode: RecommendationMode
  recentOpenAccounts24m?: number | null
  walletBalances?: WalletBalanceInput[]
  targetPointsGoal?: number | null
  showResults: boolean
}

/**
 * React hook for scoring and ranking cards
 * Returns empty array if showResults is false
 */
export function useCardScorer(inputs: UseCardScorerInputs): CardRecommendation[] {
  const {
    cards,
    spend,
    travelGoals,
    ownedCards,
    regionCode,
    programGoalMap,
    annualFeeTolerance,
    mode,
    recentOpenAccounts24m,
    walletBalances,
    targetPointsGoal,
    showResults,
  } = inputs

  return useMemo(() => {
    if (!showResults) return []

    return scoreAndRankCards(cards, {
      spend,
      travelGoals,
      ownedCards,
      regionCode,
      programGoalMap,
      annualFeeTolerance,
      mode,
      recentOpenAccounts24m,
      walletBalances,
      targetPointsGoal,
    })
  }, [
    cards,
    spend,
    travelGoals,
    ownedCards,
    regionCode,
    programGoalMap,
    annualFeeTolerance,
    mode,
    recentOpenAccounts24m,
    walletBalances,
    targetPointsGoal,
    showResults,
  ])
}
