'use client'

import { useMemo } from 'react'
import type { CardWithRates } from '@/types/database'
import type { Region } from '@/lib/regions'
import { calculateSpendOnlyRanking, type SpendOnlyResult, type RankingOptions } from '../domain'

export interface UseSpendOnlyRankingInputs {
  cards: CardWithRates[]
  spend: Partial<Record<string, string>>
  regionCode: Region
  enabled?: boolean
  limit?: number
}

/**
 * React hook for spend-only ranking (earnings view)
 * Returns empty array if enabled is false
 */
export function useSpendOnlyRanking(inputs: UseSpendOnlyRankingInputs): SpendOnlyResult[] {
  const { cards, spend, regionCode, enabled = true, limit } = inputs

  return useMemo(() => {
    if (!enabled) return []
    return calculateSpendOnlyRanking(cards, spend, regionCode, { limit })
  }, [cards, spend, regionCode, enabled, limit])
}

export type { SpendOnlyResult, RankingOptions }
