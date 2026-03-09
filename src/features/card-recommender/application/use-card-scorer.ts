'use client'

import { useMemo } from 'react'
import type { CardWithRates } from '@/types/database'
import type { Region } from '@/lib/regions'
import {
  scoreAndRankCards,
  splitRecommendationsByStatus,
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
  targetGoalValue?: number | null
  showResults: boolean
}

export interface UseCardScorerResult {
  all: CardRecommendation[]
  visible: CardRecommendation[]
  blocked: CardRecommendation[]
}

/**
 * React hook for scoring and ranking cards
 * Returns empty result if showResults is false
 */
export function useCardScorer(inputs: UseCardScorerInputs): UseCardScorerResult {
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
    targetGoalValue,
    showResults,
  } = inputs

  return useMemo(() => {
    if (!showResults) {
      return { all: [], visible: [], blocked: [] }
    }

    const all = scoreAndRankCards(cards, {
      spend,
      travelGoals,
      ownedCards,
      regionCode,
      programGoalMap,
      annualFeeTolerance,
      mode,
      recentOpenAccounts24m,
      walletBalances,
      targetGoalValue,
    })

    const { visible, blocked } = splitRecommendationsByStatus(all)
    return { all, visible, blocked }
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
    targetGoalValue,
    showResults,
  ])
}
