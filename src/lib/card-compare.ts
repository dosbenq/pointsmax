import type { CardWithRates } from '@/types/database'
import type { Region } from '@/lib/regions'
import type {
  CardComparePayload,
  CardTrustMetadata,
} from '@/features/card-recommender/domain/ui-contract'
import { buildReviewSnapshotFromCard } from '@/lib/card-surfaces'
import { getComplexityPenalty, getSoftBenefits, SOFT_BENEFIT_COPY } from '@/features/card-recommender/domain/metadata'

function getTopEarnRate(card: CardWithRates): { label: string; rate: number } | null {
  const best = Object.entries(card.earning_rates)
    .filter(([, multiplier]) => Number.isFinite(multiplier) && multiplier > 0)
    .sort(([, left], [, right]) => right - left)[0]

  if (!best) return null

  const labelMap: Record<string, string> = {
    dining: 'dining',
    groceries: 'groceries',
    travel: 'travel',
    gas: card.currency === 'INR' ? 'fuel' : 'gas',
    shopping: 'shopping',
    streaming: 'streaming',
    other: 'everyday spend',
  }

  return {
    label: labelMap[best[0]] ?? 'everyday spend',
    rate: best[1],
  }
}

function buildQuickVerdict(card: CardWithRates): string {
  const benefits = getSoftBenefits(card)
  const topRate = getTopEarnRate(card)

  if (benefits.includes('lounge_access') && topRate) {
    return `${topRate.rate}x on ${topRate.label} with premium travel perks.`
  }
  if (topRate && card.annual_fee_usd === 0) {
    return `${topRate.rate}x on ${topRate.label} without paying an annual fee.`
  }
  if (topRate) {
    return `${topRate.rate}x on ${topRate.label} makes this the core use case.`
  }
  if (benefits.length > 0) {
    return `Best used for ${SOFT_BENEFIT_COPY[benefits[0]]?.toLowerCase() ?? 'travel benefits'} rather than pure earn rate.`
  }
  return 'Useful when you want straightforward earning in the same rewards program.'
}

function buildCatalogTrustMetadata(card: CardWithRates): CardTrustMetadata {
  const completenessChecks = [
    card.annual_fee_usd >= 0,
    card.signup_bonus_pts > 0,
    Object.values(card.earning_rates).some((rate) => rate > 0),
    Boolean(card.program_name),
    Boolean(card.apply_url),
  ]
  const completenessScore = completenessChecks.filter(Boolean).length / completenessChecks.length
  const overallConfidence = completenessScore >= 0.8 ? 'high' : completenessScore >= 0.5 ? 'medium' : 'low'
  const lastVerifiedDate = new Date(card.created_at).toISOString().slice(0, 10)

  return {
    lastVerifiedDate,
    overallConfidence,
    sourcesCheckedCount: 1,
    latestChangeSummary: 'Using PointsMax catalog data while source-by-source review is still being published.',
    evidenceList: {
      annual_fee: {
        id: 'annual_fee',
        value: card.annual_fee_usd,
        sourceType: 'secondary',
        confidence: overallConfidence,
        lastCheckedAt: lastVerifiedDate,
        notes: 'Rendered from the current internal card catalog.',
      },
      rewards_profile: {
        id: 'rewards_profile',
        value: `${Object.values(card.earning_rates).filter((rate) => rate > 0).length} earn categories`,
        sourceType: 'secondary',
        confidence: overallConfidence,
        lastCheckedAt: lastVerifiedDate,
        notes: 'Normalized earn rates mapped from the current card catalog.',
      },
    },
  }
}

export function buildCardComparePayloads(cards: CardWithRates[], region: Region): CardComparePayload[] {
  const winnerAssignments = new Map<string, NonNullable<CardComparePayload['useCaseWinner']>>()

  const byTravel = [...cards].sort((left, right) => {
    const leftBenefits = getSoftBenefits(left).includes('lounge_access') ? 1 : 0
    const rightBenefits = getSoftBenefits(right).includes('lounge_access') ? 1 : 0
    if (rightBenefits !== leftBenefits) return rightBenefits - leftBenefits
    return right.cpp_cents - left.cpp_cents
  })
  const bySimplicity = [...cards].sort((left, right) => {
    const leftPenalty = getComplexityPenalty(left, region)
    const rightPenalty = getComplexityPenalty(right, region)
    if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty
    return left.annual_fee_usd - right.annual_fee_usd
  })
  const byLowFees = [...cards].sort((left, right) => {
    if (left.annual_fee_usd !== right.annual_fee_usd) return left.annual_fee_usd - right.annual_fee_usd
    return getComplexityPenalty(left, region) - getComplexityPenalty(right, region)
  })
  const byLounges = [...cards]
    .filter((card) => getSoftBenefits(card).includes('lounge_access'))
    .sort((left, right) => right.annual_fee_usd - left.annual_fee_usd)

  const assignWinner = (
    winner: CardWithRates | undefined,
    label: NonNullable<CardComparePayload['useCaseWinner']>,
  ) => {
    if (!winner || winnerAssignments.has(winner.id)) return
    winnerAssignments.set(winner.id, label)
  }

  assignWinner(byTravel[0], 'travel')
  assignWinner(byLounges[0], 'lounges')
  assignWinner(byLowFees[0], 'low_fees')
  assignWinner(bySimplicity[0], 'simplicity')

  return cards.map((card, index) => ({
    card,
    snapshot: buildReviewSnapshotFromCard(card),
    quickVerdict: buildQuickVerdict(card),
    rank: index + 1,
    useCaseWinner: winnerAssignments.get(card.id),
    trustMetadata: buildCatalogTrustMetadata(card),
  }))
}
