import type { CardWithRates, SpendCategory } from '@/types/database'
import type { Region } from '@/lib/regions'

// Travel goals for card recommendations
export const TRAVEL_GOALS = [
  { key: 'domestic', label: 'Domestic economy' },
  { key: 'intl_econ', label: 'International economy' },
  { key: 'intl_biz', label: 'International business class' },
  { key: 'hotels', label: 'Hotel nights' },
  { key: 'flex', label: 'Transferable points flexibility' },
] as const

export type TravelGoalKey = (typeof TRAVEL_GOALS)[number]['key']
export type RecommendationMode = 'next_best_card' | 'long_term_value'
export type AnnualFeeTolerance = 'low' | 'medium' | 'high'
export type RecommendationStatus = 'eligible' | 'ineligible' | 'unknown'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface WalletBalanceInput {
  program_id: string
  balance: number
  source?: 'manual' | 'connector'
  as_of?: string | null
  confidence?: ConfidenceLevel
  is_stale?: boolean
}

export interface ScoringInputs {
  spend: Partial<Record<SpendCategory, string>>
  travelGoals: Set<string>
  ownedCards: Set<string>
  regionCode: Region
  programGoalMap: Record<string, string[]>
  mode: RecommendationMode
  annualFeeTolerance: AnnualFeeTolerance
  recentOpenAccounts24m?: number | null
  walletBalances?: WalletBalanceInput[]
  targetPointsGoal?: number | null
}

export interface RecommendationScoreBreakdown {
  annualRewardsValue: number
  signupBonusValue: number
  softBenefitValue: number
  goalAlignmentBonus: number
  walletSynergyBonus: number
  feePenalty: number
  complexityPenalty: number
  totalScore: number
}

export interface RecommendationConfidence {
  level: ConfidenceLevel
  score: number
  reasons: string[]
}

export interface RecommendationExplanation {
  whyThisCard: string[]
  whyNow: string[]
  assumptions: string[]
  warnings: string[]
}

export interface EligibilityAssessment {
  status: RecommendationStatus
  reasons: string[]
  warnings: string[]
  appliedRules: import('./metadata').IssuerRuleTag[]
}

export interface CardRecommendation {
  card: CardWithRates
  rank: number
  status: RecommendationStatus
  eligibility: EligibilityAssessment
  confidence: RecommendationConfidence
  explanation: RecommendationExplanation
  breakdown: RecommendationScoreBreakdown
  pointsPerYear: number
  annualRewardsValue: number
  signupValue: number
  signupValueEligible: number
  softBenefitValue: number
  softBenefits: import('./metadata').SoftBenefitType[]
  ongoingValue: number
  firstYearValue: number
  goalCount: number
  goalMatchStrength: number
  hasCardAlready: boolean
  walletBalance: number
  estimatedMonthsToGoal: number | null
}

// Ranking and filtering options
export interface RankingOptions {
  excludeIneligible?: boolean
  limit?: number
}

// Spend-only ranking result (for earnings view)
export interface SpendOnlyResult {
  card: CardWithRates
  pointsPerYear: number
  annualValue: number
  netValue: number
}
