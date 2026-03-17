import type { CardWithRates } from '@/types/database'
import type { ConfidenceLevel } from './types'

export interface CardReviewSnapshot {
  annualFee: number
  joiningFee?: number
  currency: string
  welcomeBonus: {
    points: number
    spendRequirement: number
    timeframeMonths: number | null
    estimatedValue: number
  } | null
  headlineEarnRates: Array<{ label: string; rate: string }>
  forexFeePct: number | null
  loungeAccess: {
    hasAccess: boolean
    description?: string
  } | null
}

export interface TrustEvidence {
  id: string
  value: string | number
  sourceType: 'official' | 'secondary' | 'community'
  confidence: ConfidenceLevel
  lastCheckedAt: string
  sourceUrl?: string
  notes?: string
}

export interface CardTrustMetadata {
  lastVerifiedDate: string
  overallConfidence: ConfidenceLevel
  sourcesCheckedCount: number
  latestChangeSummary: string | null
  evidenceList: Record<string, TrustEvidence>
}

export interface CardReviewDetails {
  bestFor: string[]
  notFor: string[]
  whyItMatters: string // Plain English value explanation
  rewardsBreakdown: {
    strengths: string[]
    caps: string[]
    exclusions: string[]
    milestones: string[]
  }
  perks: string[]
  redemptionQuality: {
    cashbackValue: number | null
    transferPartnersValue: number | null
    portalValue: number | null
    statementCreditValue: number | null
  }
  realWorldExamples: {
    spendScenarios: string[]
    redemptionScenarios: string[]
  }
  hiddenCatches: string[]
}

export interface CardComparePayload {
  card: CardWithRates
  snapshot: CardReviewSnapshot
  quickVerdict: string
  rank?: number
  useCaseWinner?: 'travel' | 'simplicity' | 'lounges' | 'low_fees'
  trustMetadata?: CardTrustMetadata | null
}
