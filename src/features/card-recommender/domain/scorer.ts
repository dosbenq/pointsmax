import type { CardWithRates, SpendCategory } from '@/types/database'
import type { Region } from '@/lib/regions'
import { yearlyPointsFromSpend, getCategoriesForRegion } from '@/lib/card-tools'
import {
  getCardFeatureProfile,
  getComplexityPenalty,
  getSoftBenefitAnnualValue,
  getSoftBenefits,
  SOFT_BENEFIT_COPY,
  type SoftBenefitType,
} from './metadata'
import type {
  TravelGoalKey,
  RecommendationMode,
  AnnualFeeTolerance,
  RecommendationStatus,
  ConfidenceLevel,
  WalletBalanceInput,
  ScoringInputs,
  RecommendationScoreBreakdown,
  RecommendationConfidence,
  RecommendationExplanation,
  EligibilityAssessment,
  CardRecommendation,
} from './types'

// Re-export for backward compatibility
export { SOFT_BENEFIT_COPY, type SoftBenefitType }
export type { TravelGoalKey, RecommendationMode, AnnualFeeTolerance, RecommendationStatus, ConfidenceLevel }
export type { WalletBalanceInput, ScoringInputs, RecommendationScoreBreakdown, RecommendationConfidence }
export type { RecommendationExplanation, EligibilityAssessment, CardRecommendation }

// Note: TRAVEL_GOALS is exported from types.ts

const REGION_BASE_BONUS: Record<'US' | 'IN', number> = {
  US: 180,
  IN: 5000,
}

const MODE_WEIGHTS: Record<RecommendationMode, {
  annualRewards: number
  signupBonus: number
  softBenefits: number
  goalAlignment: number
  walletSynergy: number
}> = {
  long_term_value: {
    annualRewards: 1.15,
    signupBonus: 0.25,
    softBenefits: 0.65,
    goalAlignment: 1,
    walletSynergy: 0.7,
  },
  next_best_card: {
    annualRewards: 0.8,
    signupBonus: 1,
    softBenefits: 0.35,
    goalAlignment: 1.2,
    walletSynergy: 1.4,
  },
}

function regionKey(regionCode: Region): 'US' | 'IN' {
  return regionCode === 'in' ? 'IN' : 'US'
}

function getRegionBaseBonus(regionCode: Region): number {
  return REGION_BASE_BONUS[regionKey(regionCode)]
}

function parseSpendValue(value: string | undefined): number {
  return Number.parseFloat((value ?? '0').replace(/,/g, '')) || 0
}

function getFeePenalty(card: CardWithRates, tolerance: AnnualFeeTolerance): number {
  const fee = card.annual_fee_usd
  if (fee <= 0) return 0

  if (tolerance === 'high') return fee * 0.15
  if (tolerance === 'medium') return fee * 0.4

  const lowToleranceSurcharge = fee > 95 && fee < 1000 ? fee * 0.35 : fee * 0.55
  return fee * 0.75 + lowToleranceSurcharge
}

/**
 * Calculate how many travel goals a card matches
 */
export function goalMatchScore(
  card: CardWithRates,
  goals: Set<string>,
  programGoalMap: Record<string, string[]>
): number {
  const programGoals = programGoalMap[card.program_slug] ?? []
  let count = 0
  for (const goal of goals) {
    if (programGoals.includes(goal)) count += 1
  }
  return count
}

function getGoalMatchStrength(goalCount: number, selectedGoalCount: number): number {
  if (selectedGoalCount === 0) return 0
  return Math.min(1, goalCount / selectedGoalCount)
}

function getGoalAlignmentBonus(
  card: CardWithRates,
  annualRewardsValue: number,
  goalMatchStrength: number,
  regionCode: Region,
): number {
  if (goalMatchStrength <= 0) return 0
  const base = Math.max(getRegionBaseBonus(regionCode), annualRewardsValue * 0.35)
  const flexBoost = card.program_slug.includes('chase')
    || card.program_slug.includes('amex')
    || card.program_slug.includes('capital')
    || card.program_slug.includes('citi')
    || card.program_slug.includes('bilt')
      ? 1.15
      : 1
  return base * goalMatchStrength * flexBoost
}

function getWalletBalanceForCard(card: CardWithRates, walletBalances: WalletBalanceInput[]): number {
  const sameProgram = walletBalances.find((balance) => balance.program_id === card.program_id)
  return sameProgram?.balance ?? 0
}

function getWalletSynergyBonus(
  card: CardWithRates,
  walletBalance: number,
  regionCode: Region,
): number {
  if (walletBalance <= 0) return 0
  const valueOfExistingBalance = (walletBalance * card.cpp_cents) / 100
  return Math.min(Math.max(getRegionBaseBonus(regionCode) * 0.75, valueOfExistingBalance * 0.04), getRegionBaseBonus(regionCode) * 2.4)
}

function getTopSpendCategory(
  spend: Partial<Record<SpendCategory, string>>,
  categories: Array<{ key: SpendCategory; label: string }>
): { key: SpendCategory; label: string; monthlySpend: number } | null {
  let best: { key: SpendCategory; label: string; monthlySpend: number } | null = null
  for (const category of categories) {
    const monthlySpend = parseSpendValue(spend[category.key])
    if (!best || monthlySpend > best.monthlySpend) {
      best = { ...category, monthlySpend }
    }
  }
  return best && best.monthlySpend > 0 ? best : null
}

/**
 * Calculate yearly points earned from spend across all categories
 */
export function calculateYearlyPoints(
  card: CardWithRates,
  spend: Partial<Record<SpendCategory, string>>,
  categories: Array<{ key: SpendCategory }>
): number {
  return categories.reduce((sum, { key }) => {
    const monthly = parseSpendValue(spend[key])
    return (
      sum +
      yearlyPointsFromSpend({
        monthlySpend: monthly,
        earnMultiplier:
          key === 'shopping'
            ? (card.earning_rates.shopping ?? card.earning_rates.other ?? 1)
            : (card.earning_rates[key] ?? 1),
        earnUnit: card.earn_unit,
      })
    )
  }, 0)
}

/**
 * Assess card eligibility based on issuer rules and user profile
 */
export function assessEligibility(card: CardWithRates, inputs: ScoringInputs): EligibilityAssessment {
  const reasons: string[] = []
  const warnings: string[] = []
  const profile = getCardFeatureProfile(card)
  const appliedRules = [...profile.issuerRules]

  if (inputs.ownedCards.has(card.id) && profile.issuerRules.includes('duplicate_card_not_allowed')) {
    reasons.push('Already in your wallet')
  }

  if (
    profile.issuerRules.includes('chase_5_24')
    && typeof inputs.recentOpenAccounts24m === 'number'
    && inputs.recentOpenAccounts24m >= 5
  ) {
    reasons.push('Chase 5/24 likely blocks approval')
  }

  if (profile.issuerRules.includes('bonus_eligibility_uncertain')) {
    warnings.push('Bonus eligibility may depend on issuer family and offer history')
  }

  if (reasons.length > 0) {
    return { status: 'ineligible', reasons, warnings, appliedRules }
  }

  if (warnings.length > 0) {
    return { status: 'unknown', reasons, warnings, appliedRules }
  }

  return { status: 'eligible', reasons, warnings, appliedRules }
}

function buildConfidence(
  card: CardWithRates,
  inputs: ScoringInputs,
  eligibility: EligibilityAssessment,
  walletBalance: number,
  goalMatchStrength: number,
): RecommendationConfidence {
  let score = 0.94
  const reasons: string[] = []

  if (eligibility.status === 'unknown') {
    score -= 0.18
    reasons.push('Issuer-rule certainty is incomplete')
  }

  if (inputs.mode === 'next_best_card' && (inputs.walletBalances?.length ?? 0) === 0) {
    score -= 0.12
    reasons.push('No wallet balances connected, so synergy is estimated conservatively')
  }

  if ((inputs.walletBalances ?? []).some((balance) => balance.is_stale)) {
    score -= 0.08
    reasons.push('Some wallet balances are stale')
  }

  if (
    card.issuer.toLowerCase().includes('chase')
    && typeof inputs.recentOpenAccounts24m !== 'number'
  ) {
    score -= 0.1
    reasons.push('Chase eligibility confidence is lower without recent application count')
  }

  if (inputs.travelGoals.size > 0 && goalMatchStrength === 0) {
    score -= 0.08
    reasons.push('Goal fit is weak for the selected travel intent')
  }

  if (inputs.mode === 'next_best_card' && walletBalance > 0) {
    reasons.push('Existing wallet balance increases confidence in the recommendation fit')
  }

  const bounded = Math.max(0.2, Math.min(0.99, score))
  const level: ConfidenceLevel =
    bounded >= 0.85 ? 'high' : bounded >= 0.65 ? 'medium' : 'low'

  return { level, score: bounded, reasons }
}

function buildExplanation(
  card: CardWithRates,
  inputs: ScoringInputs,
  annualRewardsValue: number,
  signupValueEligible: number,
  softBenefitValue: number,
  goalCount: number,
  walletBalance: number,
  estimatedMonthsToGoal: number | null,
  eligibility: EligibilityAssessment,
): RecommendationExplanation {
  const whyThisCard: string[] = []
  const whyNow: string[] = []
  const assumptions: string[] = []
  const warnings = [...eligibility.warnings]
  const categories = getCategoriesForRegion(inputs.regionCode)
  const topSpendCategory = getTopSpendCategory(inputs.spend, categories)

  if (topSpendCategory && (card.earning_rates[topSpendCategory.key] ?? 1) > 1) {
    whyThisCard.push(
      `${card.name} pays ${card.earning_rates[topSpendCategory.key]}x on your highest spend category: ${topSpendCategory.label.toLowerCase()}.`
    )
  }

  if (goalCount > 0) {
    whyThisCard.push(
      `${card.program_name} supports ${goalCount} of your selected travel goals.`
    )
  }

  if (softBenefitValue > 0) {
    const benefitLabels = getSoftBenefits(card).map((benefit) => SOFT_BENEFIT_COPY[benefit]).join(', ')
    whyThisCard.push(`Structured benefit value includes ${benefitLabels}.`)
  }

  if (walletBalance > 0) {
    whyThisCard.push(`You already hold ${Math.round(walletBalance).toLocaleString()} ${card.program_name} points, so this card compounds an existing balance.`)
  }

  if (inputs.mode === 'next_best_card' && signupValueEligible > 0) {
    whyNow.push('The intro bonus drives most of the short-term value, making this stronger as a next-card move than as a pure keeper card.')
  }

  if (estimatedMonthsToGoal !== null) {
    whyNow.push(`At your current spend, this card could get you to your stated points target in about ${estimatedMonthsToGoal} month${estimatedMonthsToGoal === 1 ? '' : 's'}.`)
  }

  assumptions.push('Spend-based estimates assume your monthly inputs remain stable over the next year.')
  if (softBenefitValue > 0) {
    assumptions.push('Benefit value assumes you will actually use the listed travel and lifestyle perks.')
  }
  if (annualRewardsValue <= 0) {
    warnings.push('Your current spend inputs are too low to create meaningful ongoing rewards value.')
  }
  if (inputs.targetPointsGoal && walletBalance === 0) {
    assumptions.push('Time-to-goal only counts tracked balances in the same rewards program.')
  }

  return { whyThisCard, whyNow, assumptions, warnings }
}

function calculateEstimatedMonthsToGoal(
  card: CardWithRates,
  inputs: ScoringInputs,
  pointsPerYear: number,
  walletBalance: number,
  hasCardAlready: boolean,
): number | null {
  const target = inputs.targetPointsGoal
  if (!target || target <= 0) return null

  const immediatePoints = walletBalance + (hasCardAlready ? 0 : card.signup_bonus_pts)
  if (immediatePoints >= target) return 0

  const monthlyPoints = pointsPerYear / 12
  if (monthlyPoints <= 0) return null

  const remaining = target - immediatePoints
  return Math.ceil(remaining / monthlyPoints)
}

function getWeightedTotal(
  breakdown: Omit<RecommendationScoreBreakdown, 'totalScore'>,
  mode: RecommendationMode,
): number {
  const weights = MODE_WEIGHTS[mode]
  return (
    breakdown.annualRewardsValue * weights.annualRewards +
    breakdown.signupBonusValue * weights.signupBonus +
    breakdown.softBenefitValue * weights.softBenefits +
    breakdown.goalAlignmentBonus * weights.goalAlignment +
    breakdown.walletSynergyBonus * weights.walletSynergy -
    breakdown.feePenalty -
    breakdown.complexityPenalty
  )
}

function compareRecommendations(a: CardRecommendation, b: CardRecommendation): number {
  const statusOrder: Record<RecommendationStatus, number> = {
    eligible: 0,
    unknown: 1,
    ineligible: 2,
  }
  if (statusOrder[a.status] !== statusOrder[b.status]) {
    return statusOrder[a.status] - statusOrder[b.status]
  }

  if (b.breakdown.totalScore !== a.breakdown.totalScore) {
    return b.breakdown.totalScore - a.breakdown.totalScore
  }

  if (b.confidence.score !== a.confidence.score) {
    return b.confidence.score - a.confidence.score
  }

  if (b.goalMatchStrength !== a.goalMatchStrength) {
    return b.goalMatchStrength - a.goalMatchStrength
  }

  if (a.breakdown.feePenalty !== b.breakdown.feePenalty) {
    return a.breakdown.feePenalty - b.breakdown.feePenalty
  }

  return a.card.id.localeCompare(b.card.id)
}

/**
 * Score a single card based on inputs
 */
export function scoreCard(card: CardWithRates, inputs: ScoringInputs): CardRecommendation {
  const categories = getCategoriesForRegion(inputs.regionCode)
  const pointsPerYear = calculateYearlyPoints(card, inputs.spend, categories)
  const annualRewardsValue = (pointsPerYear * card.cpp_cents) / 100
  const signupValue = (card.signup_bonus_pts * card.cpp_cents) / 100
  const hasCardAlready = inputs.ownedCards.has(card.id)
  const signupValueEligible = hasCardAlready ? 0 : signupValue
  const softBenefitValue = getSoftBenefitAnnualValue(card, inputs.regionCode)
  const ongoingValue = annualRewardsValue + softBenefitValue - card.annual_fee_usd
  const firstYearValue = ongoingValue + signupValueEligible
  const goalCount = goalMatchScore(card, inputs.travelGoals, inputs.programGoalMap)
  const goalMatchStrength = getGoalMatchStrength(goalCount, inputs.travelGoals.size)
  const walletBalance = getWalletBalanceForCard(card, inputs.walletBalances ?? [])
  const eligibility = assessEligibility(card, inputs)
  const goalAlignmentBonus = getGoalAlignmentBonus(card, annualRewardsValue, goalMatchStrength, inputs.regionCode)
  const walletSynergyBonus = getWalletSynergyBonus(card, walletBalance, inputs.regionCode)
  const feePenalty = getFeePenalty(card, inputs.annualFeeTolerance)
  const complexityPenalty = getComplexityPenalty(card, inputs.regionCode)
  const estimatedMonthsToGoal = calculateEstimatedMonthsToGoal(card, inputs, pointsPerYear, walletBalance, hasCardAlready)

  const partialBreakdown = {
    annualRewardsValue,
    signupBonusValue: signupValueEligible,
    softBenefitValue,
    goalAlignmentBonus,
    walletSynergyBonus,
    feePenalty,
    complexityPenalty,
  }
  const totalScore =
    eligibility.status === 'ineligible'
      ? Number.NEGATIVE_INFINITY
      : getWeightedTotal(partialBreakdown, inputs.mode)

  const confidence = buildConfidence(card, inputs, eligibility, walletBalance, goalMatchStrength)
  const explanation = buildExplanation(
    card,
    inputs,
    annualRewardsValue,
    signupValueEligible,
    softBenefitValue,
    goalCount,
    walletBalance,
    estimatedMonthsToGoal,
    eligibility,
  )

  return {
    card,
    rank: 0,
    status: eligibility.status,
    eligibility,
    confidence,
    explanation,
    breakdown: {
      ...partialBreakdown,
      totalScore,
    },
    pointsPerYear,
    annualRewardsValue,
    signupValue,
    signupValueEligible,
    softBenefitValue,
    softBenefits: getSoftBenefits(card),
    ongoingValue,
    firstYearValue,
    goalCount,
    goalMatchStrength,
    hasCardAlready,
    walletBalance,
    estimatedMonthsToGoal,
  }
}

/**
 * Score and rank all cards based on inputs
 */
export function scoreAndRankCards(cards: CardWithRates[], inputs: ScoringInputs): CardRecommendation[] {
  return cards
    .map((card) => scoreCard(card, inputs))
    .sort(compareRecommendations)
    .map((result, index) => ({
      ...result,
      rank: result.status === 'ineligible' ? 0 : index + 1,
    }))
}
