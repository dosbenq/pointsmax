import { describe, expect, it } from 'vitest'
import type { CardWithRates } from '@/types/database'
import {
  assessEligibility,
  calculateYearlyPoints,
  getCardFeatureProfile,
  getSoftBenefits,
  getSoftBenefitAnnualValue,
  scoreAndRankCards,
  scoreCard,
  SOFT_BENEFIT_COPY,
  SOFT_BENEFIT_VALUES,
  TRAVEL_GOALS,
  type ScoringInputs,
} from '../domain'

const mockCard = (overrides: Partial<CardWithRates> = {}): CardWithRates => ({
  id: 'card-1',
  name: 'Test Card',
  issuer: 'Test Bank',
  annual_fee_usd: 95,
  currency: 'USD',
  earn_unit: '1_dollar',
  geography: 'US',
  signup_bonus_pts: 60000,
  signup_bonus_spend: 4000,
  program_id: 'prog-1',
  apply_url: 'https://example.com',
  is_active: true,
  display_order: 1,
  created_at: '2024-01-01',
  program_name: 'Test Program',
  program_slug: 'chase-ur',
  cpp_cents: 2,
  earning_rates: {
    dining: 3,
    groceries: 2,
    travel: 3,
    gas: 1,
    shopping: 1.5,
    streaming: 1,
    other: 1,
  },
  ...overrides,
})

const mockInputs = (overrides: Partial<ScoringInputs> = {}): ScoringInputs => ({
  spend: {
    dining: '800',
    groceries: '600',
    travel: '300',
    other: '900',
  },
  travelGoals: new Set(['intl_biz', 'flex']),
  ownedCards: new Set(),
  regionCode: 'us',
  programGoalMap: {
    'chase-ur': ['intl_econ', 'intl_biz', 'flex', 'hotels'],
    hyatt: ['hotels'],
    united: ['domestic', 'intl_econ'],
  },
  mode: 'next_best_card',
  annualFeeTolerance: 'medium',
  recentOpenAccounts24m: 2,
  walletBalances: [],
  targetPointsGoal: null,
  ...overrides,
})

describe('card recommender domain metadata', () => {
  it('exposes travel goals', () => {
    expect(TRAVEL_GOALS.map(goal => goal.key)).toEqual([
      'domestic',
      'intl_econ',
      'intl_biz',
      'hotels',
      'flex',
    ])
  })

  it('uses structured soft benefits config', () => {
    expect(getSoftBenefits('amex platinum')).toEqual([
      'lounge_access',
      'hotel_status',
      'concierge',
    ])
    expect(getSoftBenefitAnnualValue('amex platinum', 'us')).toBe(800)
    expect(getSoftBenefitAnnualValue('hdfc infinia', 'in')).toBe(45000)
    expect(SOFT_BENEFIT_COPY.lounge_access).toBe('Lounge Access')
    expect(SOFT_BENEFIT_VALUES.US.travel_insurance).toBe(150)
  })

  it('uses currency-aware default complexity thresholds', () => {
    expect(getCardFeatureProfile(mockCard({ annual_fee_usd: 550, currency: 'USD' })).complexity).toBe('high')
    expect(getCardFeatureProfile(mockCard({ annual_fee_usd: 10000, currency: 'INR' })).complexity).toBe('medium')
    expect(getCardFeatureProfile(mockCard({ annual_fee_usd: 30000, currency: 'INR' })).complexity).toBe('high')
  })
})

describe('calculateYearlyPoints', () => {
  it('calculates category earnings for dollar cards', () => {
    const card = mockCard()
    const points = calculateYearlyPoints(card, { dining: '100', travel: '50' }, [
      { key: 'dining' },
      { key: 'travel' },
    ])

    expect(points).toBe(5400)
  })

  it('supports rupee-based earn units', () => {
    const card = mockCard({
      currency: 'INR',
      earn_unit: '100_inr',
      earning_rates: {
        dining: 5,
        groceries: 3,
        travel: 2,
        gas: 1,
        shopping: 1,
        streaming: 1,
        other: 1,
      },
    })
    const points = calculateYearlyPoints(card, { dining: '10000' }, [{ key: 'dining' }])
    expect(points).toBe(6000)
  })
})

describe('assessEligibility', () => {
  it('blocks duplicate cards when already owned', () => {
    const card = mockCard({ name: 'Chase Sapphire Preferred', issuer: 'Chase' })
    const result = assessEligibility(card, mockInputs({ ownedCards: new Set([card.id]) }))

    expect(result.status).toBe('ineligible')
    expect(result.reasons).toContain('Already in your wallet')
  })

  it('blocks Chase cards when over 5/24', () => {
    const card = mockCard({ name: 'Chase Sapphire Reserve', issuer: 'Chase' })
    const result = assessEligibility(card, mockInputs({ recentOpenAccounts24m: 5 }))

    expect(result.status).toBe('ineligible')
    expect(result.reasons).toContain('Chase 5/24 likely blocks approval')
  })

  it('downgrades to unknown when issuer bonus rules are uncertain', () => {
    const card = mockCard({ name: 'Amex Platinum', issuer: 'American Express' })
    const result = assessEligibility(card, mockInputs())

    expect(result.status).toBe('unknown')
    expect(result.warnings).toContain('Bonus eligibility may depend on issuer family and offer history')
  })
})

describe('scoreCard', () => {
  it('returns explanation, confidence, and score breakdown', () => {
    const card = mockCard({
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
    })
    const result = scoreCard(card, mockInputs())

    expect(result.status).toBe('eligible')
    expect(result.rank).toBe(0)
    expect(result.breakdown.totalScore).toBeGreaterThan(0)
    expect(result.explanation.whyThisCard.length).toBeGreaterThan(0)
    expect(result.explanation.assumptions.length).toBeGreaterThan(0)
    expect(result.confidence.level).toBe('medium')
  })

  it('uses wallet balance and goal target for next-best-card mode', () => {
    const card = mockCard({
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
      program_id: 'prog-1',
      signup_bonus_pts: 50000,
    })
    const result = scoreCard(
      card,
      mockInputs({
        walletBalances: [
          { program_id: 'prog-1', balance: 25000, source: 'manual', confidence: 'high', is_stale: false },
        ],
        targetPointsGoal: 90000,
      }),
    )

    expect(result.walletBalance).toBe(25000)
    expect(result.breakdown.walletSynergyBonus).toBeGreaterThan(0)
    expect(result.estimatedMonthsToGoal).toBeGreaterThan(0)
    expect(result.explanation.whyThisCard.join(' ')).toContain('existing balance')
  })

  it('lowers confidence when wallet context is missing in next-best-card mode', () => {
    const card = mockCard({ name: 'Amex Gold', issuer: 'American Express', program_slug: 'amex-mr' })
    const result = scoreCard(card, mockInputs())

    expect(result.confidence.score).toBeLessThan(0.94)
    expect(result.confidence.reasons.join(' ')).toContain('No wallet balances connected')
  })
})

describe('scoreAndRankCards', () => {
  it('sorts eligible cards above ineligible cards', () => {
    const eligibleCard = mockCard({
      id: 'eligible',
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
      annual_fee_usd: 95,
    })
    const blockedCard = mockCard({
      id: 'blocked',
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase',
    })

    const results = scoreAndRankCards(
      [blockedCard, eligibleCard],
      mockInputs({
        ownedCards: new Set(['blocked']),
      }),
    )

    expect(results[0].card.id).toBe('eligible')
    expect(results[0].status).toBe('eligible')
    expect(results[1].status).toBe('ineligible')
  })

  it('boosts cards that compound an existing wallet balance', () => {
    const chaseCard = mockCard({
      id: 'chase',
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
      program_id: 'prog-chase',
      program_slug: 'chase-ur',
    })
    const hotelCard = mockCard({
      id: 'hotel',
      name: 'World of Hyatt Card',
      issuer: 'Chase',
      program_id: 'prog-hyatt',
      program_name: 'World of Hyatt',
      program_slug: 'hyatt',
      annual_fee_usd: 95,
      signup_bonus_pts: 30000,
      cpp_cents: 1.8,
      earning_rates: {
        dining: 2,
        groceries: 1,
        travel: 2,
        gas: 1,
        shopping: 1,
        streaming: 1,
        other: 1,
      },
    })

    const withoutWallet = scoreAndRankCards(
      [hotelCard, chaseCard],
      mockInputs({
        walletBalances: [],
        targetPointsGoal: null,
      }),
    )
    const withWallet = scoreAndRankCards(
      [hotelCard, chaseCard],
      mockInputs({
        walletBalances: [
          { program_id: 'prog-hyatt', balance: 60000, source: 'manual', confidence: 'high', is_stale: false },
        ],
        targetPointsGoal: 90000,
      }),
    )

    const hotelWithoutWallet = withoutWallet.find(result => result.card.id === 'hotel')
    const hotelWithWallet = withWallet.find(result => result.card.id === 'hotel')

    expect(hotelWithoutWallet).toBeDefined()
    expect(hotelWithWallet).toBeDefined()
    expect(hotelWithWallet!.breakdown.walletSynergyBonus).toBeGreaterThan(0)
    expect(hotelWithWallet!.breakdown.totalScore).toBeGreaterThan(hotelWithoutWallet!.breakdown.totalScore)
  })

  it('calculates time-to-goal correctly when already at target', () => {
    const card = mockCard({
      id: 'card-1',
      program_id: 'prog-1',
      signup_bonus_pts: 50000,
    })
    const result = scoreCard(
      card,
      mockInputs({
        walletBalances: [
          { program_id: 'prog-1', balance: 100000, source: 'manual', confidence: 'high', is_stale: false },
        ],
        targetPointsGoal: 80000,
      }),
    )

    expect(result.estimatedMonthsToGoal).toBe(0)
    // When at target, explanation mentions "0 months"
    expect(result.explanation.whyNow.join(' ')).toContain('0 month')
  })

  it('applies different fee penalties based on tolerance level', () => {
    const highFeeCard = mockCard({
      id: 'premium',
      name: 'Premium Card',
      issuer: 'Amex',
      annual_fee_usd: 550,
    })

    const lowToleranceResult = scoreCard(
      highFeeCard,
      mockInputs({ annualFeeTolerance: 'low' }),
    )
    const mediumToleranceResult = scoreCard(
      highFeeCard,
      mockInputs({ annualFeeTolerance: 'medium' }),
    )
    const highToleranceResult = scoreCard(
      highFeeCard,
      mockInputs({ annualFeeTolerance: 'high' }),
    )

    // Low tolerance should have highest fee penalty
    expect(lowToleranceResult.breakdown.feePenalty).toBeGreaterThan(mediumToleranceResult.breakdown.feePenalty)
    expect(mediumToleranceResult.breakdown.feePenalty).toBeGreaterThan(highToleranceResult.breakdown.feePenalty)
  })

  it('handles India region with correct currency scaling', () => {
    const inrCard = mockCard({
      id: 'inr-card',
      name: 'HDFC Infinia',
      issuer: 'HDFC',
      currency: 'INR',
      earn_unit: '100_inr',
      annual_fee_usd: 12500,
      cpp_cents: 1,
      earning_rates: {
        dining: 5,
        groceries: 1,
        travel: 1,
        gas: 1,
        shopping: 1,
        streaming: 1,
        other: 1,
      },
    })

    const result = scoreCard(
      inrCard,
      mockInputs({
        regionCode: 'in',
        spend: { dining: '50000' }, // ₹50k monthly
      }),
    )

    expect(result.pointsPerYear).toBe(30000) // ₹50k / 100 * 5 * 12
    expect(result.card.currency).toBe('INR')
  })

  it('matches multiple travel goals correctly', () => {
    const card = mockCard({
      id: 'multi-goal',
      program_slug: 'chase-ur',
    })

    const result = scoreCard(
      card,
      mockInputs({
        travelGoals: new Set(['intl_econ', 'intl_biz', 'hotels', 'flex']),
        programGoalMap: {
          'chase-ur': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
        },
      }),
    )

    expect(result.goalCount).toBe(4)
    expect(result.goalMatchStrength).toBe(1) // Perfect match
    expect(result.breakdown.goalAlignmentBonus).toBeGreaterThan(0)
  })

  it('handles empty cards array', () => {
    const results = scoreAndRankCards([], mockInputs())
    expect(results).toHaveLength(0)
  })

  it('excludes signup bonus value when card is already owned', () => {
    const card = mockCard({
      id: 'owned-card',
      name: 'Chase Card',
      issuer: 'Chase',
      signup_bonus_pts: 60000,
    })

    const result = scoreCard(
      card,
      mockInputs({
        ownedCards: new Set(['owned-card']),
      }),
    )

    expect(result.signupValueEligible).toBe(0)
    expect(result.hasCardAlready).toBe(true)
  })
})
