import { describe, expect, it } from 'vitest'
import type { CardWithRates } from '@/types/database'
import {
  calculateSpendOnlyRanking,
  splitRecommendationsByStatus,
  filterEligibleRecommendations,
  filterIneligibleRecommendations,
  getTopRecommendations,
  getEligibleCount,
  getIneligibleCount,
  hasRecommendations,
  getRecommendationByCardId,
} from '../domain'
import type { CardRecommendation } from '../domain'

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

const mockRecommendation = (overrides: Partial<CardRecommendation> = {}): CardRecommendation => ({
  card: mockCard(),
  rank: 1,
  status: 'eligible',
  eligibility: { status: 'eligible', reasons: [], warnings: [], appliedRules: [] },
  confidence: { level: 'high', score: 0.9, reasons: [] },
  explanation: { whyThisCard: [], whyNow: [], assumptions: [], warnings: [] },
  breakdown: {
    annualRewardsValue: 500,
    signupBonusValue: 1200,
    softBenefitValue: 0,
    goalAlignmentBonus: 100,
    walletSynergyBonus: 0,
    feePenalty: 95,
    complexityPenalty: 0,
    totalScore: 1705,
  },
  pointsPerYear: 25000,
  annualRewardsValue: 500,
  signupValue: 1200,
  signupValueEligible: 1200,
  softBenefitValue: 0,
  softBenefits: [],
  ongoingValue: 405,
  firstYearValue: 1605,
  goalCount: 1,
  goalMatchStrength: 0.5,
  hasCardAlready: false,
  walletBalance: 0,
  estimatedMonthsToGoal: null,
  ...overrides,
})

describe('calculateSpendOnlyRanking', () => {
  it('ranks cards by net value from spend', () => {
    const lowValueCard = mockCard({
      id: 'low',
      name: 'Low Value Card',
      annual_fee_usd: 550,
      earning_rates: { dining: 1, groceries: 1, travel: 1, gas: 1, shopping: 1, streaming: 1, other: 1 },
    })
    const highValueCard = mockCard({
      id: 'high',
      name: 'High Value Card',
      annual_fee_usd: 0,
      earning_rates: { dining: 5, groceries: 5, travel: 5, gas: 5, shopping: 5, streaming: 5, other: 5 },
    })

    const results = calculateSpendOnlyRanking(
      [lowValueCard, highValueCard],
      { dining: '1000', groceries: '500' },
      'us'
    )

    expect(results).toHaveLength(2)
    expect(results[0].card.id).toBe('high')
    expect(results[1].card.id).toBe('low')
    expect(results[0].netValue).toBeGreaterThan(results[1].netValue)
  })

  it('respects the limit option', () => {
    const cards = [
      mockCard({ id: '1', name: 'Card 1' }),
      mockCard({ id: '2', name: 'Card 2' }),
      mockCard({ id: '3', name: 'Card 3' }),
    ]

    const results = calculateSpendOnlyRanking(cards, { dining: '100' }, 'us', { limit: 2 })

    expect(results).toHaveLength(2)
  })

  it('calculates points per year correctly for USD cards', () => {
    const card = mockCard({
      earning_rates: { dining: 3, groceries: 1, travel: 1, gas: 1, shopping: 1, streaming: 1, other: 1 },
    })

    const results = calculateSpendOnlyRanking([card], { dining: '1000' }, 'us')

    // $1000/month * 3x * 12 months = 36,000 points
    expect(results[0].pointsPerYear).toBe(36000)
  })

  it('calculates points per year correctly for INR cards', () => {
    const card = mockCard({
      currency: 'INR',
      earn_unit: '100_inr',
      earning_rates: { dining: 5, groceries: 1, travel: 1, gas: 1, shopping: 1, streaming: 1, other: 1 },
    })

    const results = calculateSpendOnlyRanking([card], { dining: '10000' }, 'in')

    // ₹10000/month / 100 * 5x * 12 months = 6,000 points
    expect(results[0].pointsPerYear).toBe(6000)
  })

  it('handles empty spend inputs', () => {
    const card = mockCard()

    const results = calculateSpendOnlyRanking([card], {}, 'us')

    expect(results[0].pointsPerYear).toBe(0)
    expect(results[0].annualValue).toBe(0)
    expect(results[0].netValue).toBe(-card.annual_fee_usd)
  })
})

describe('splitRecommendationsByStatus', () => {
  it('splits recommendations into visible and blocked', () => {
    const eligible = mockRecommendation({ status: 'eligible', card: mockCard({ id: 'e1' }) })
    const unknown = mockRecommendation({ status: 'unknown', card: mockCard({ id: 'u1' }) })
    const ineligible = mockRecommendation({ status: 'ineligible', card: mockCard({ id: 'i1' }) })

    const { visible, blocked } = splitRecommendationsByStatus([eligible, unknown, ineligible])

    expect(visible).toHaveLength(2)
    expect(visible.map(r => r.card.id)).toContain('e1')
    expect(visible.map(r => r.card.id)).toContain('u1')
    expect(blocked).toHaveLength(1)
    expect(blocked[0].card.id).toBe('i1')
  })

  it('handles all eligible recommendations', () => {
    const recs = [
      mockRecommendation({ status: 'eligible' }),
      mockRecommendation({ status: 'eligible', card: mockCard({ id: '2' }) }),
    ]

    const { visible, blocked } = splitRecommendationsByStatus(recs)

    expect(visible).toHaveLength(2)
    expect(blocked).toHaveLength(0)
  })

  it('handles all ineligible recommendations', () => {
    const recs = [
      mockRecommendation({ status: 'ineligible' }),
      mockRecommendation({ status: 'ineligible', card: mockCard({ id: '2' }) }),
    ]

    const { visible, blocked } = splitRecommendationsByStatus(recs)

    expect(visible).toHaveLength(0)
    expect(blocked).toHaveLength(2)
  })
})

describe('filterEligibleRecommendations', () => {
  it('returns only eligible and unknown recommendations', () => {
    const eligible = mockRecommendation({ status: 'eligible' })
    const unknown = mockRecommendation({ status: 'unknown', card: mockCard({ id: 'u1' }) })
    const ineligible = mockRecommendation({ status: 'ineligible', card: mockCard({ id: 'i1' }) })

    const filtered = filterEligibleRecommendations([eligible, unknown, ineligible])

    expect(filtered).toHaveLength(2)
    expect(filtered.every(r => r.status !== 'ineligible')).toBe(true)
  })
})

describe('filterIneligibleRecommendations', () => {
  it('returns only ineligible recommendations', () => {
    const eligible = mockRecommendation({ status: 'eligible' })
    const ineligible = mockRecommendation({ status: 'ineligible', card: mockCard({ id: 'i1' }) })

    const filtered = filterIneligibleRecommendations([eligible, ineligible])

    expect(filtered).toHaveLength(1)
    expect(filtered[0].status).toBe('ineligible')
  })
})

describe('getTopRecommendations', () => {
  it('returns top N recommendations', () => {
    const recs = [
      mockRecommendation({ rank: 1 }),
      mockRecommendation({ rank: 2, card: mockCard({ id: '2' }) }),
      mockRecommendation({ rank: 3, card: mockCard({ id: '3' }) }),
    ]

    const top = getTopRecommendations(recs, 2)

    expect(top).toHaveLength(2)
  })

  it('handles count larger than array', () => {
    const recs = [mockRecommendation()]

    const top = getTopRecommendations(recs, 5)

    expect(top).toHaveLength(1)
  })
})

describe('getRecommendationByCardId', () => {
  it('finds recommendation by card ID', () => {
    const recs = [
      mockRecommendation({ card: mockCard({ id: '1' }) }),
      mockRecommendation({ card: mockCard({ id: '2' }) }),
    ]

    const found = getRecommendationByCardId(recs, '2')

    expect(found?.card.id).toBe('2')
  })

  it('returns undefined if not found', () => {
    const recs = [mockRecommendation()]

    const found = getRecommendationByCardId(recs, 'nonexistent')

    expect(found).toBeUndefined()
  })
})

describe('hasRecommendations', () => {
  it('returns true when there are eligible recommendations', () => {
    const recs = [
      mockRecommendation({ status: 'eligible' }),
      mockRecommendation({ status: 'ineligible', card: mockCard({ id: '2' }) }),
    ]

    expect(hasRecommendations(recs)).toBe(true)
  })

  it('returns false when all recommendations are ineligible', () => {
    const recs = [
      mockRecommendation({ status: 'ineligible' }),
      mockRecommendation({ status: 'ineligible', card: mockCard({ id: '2' }) }),
    ]

    expect(hasRecommendations(recs)).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(hasRecommendations([])).toBe(false)
  })
})

describe('getEligibleCount', () => {
  it('counts eligible and unknown recommendations', () => {
    const recs = [
      mockRecommendation({ status: 'eligible' }),
      mockRecommendation({ status: 'unknown', card: mockCard({ id: '2' }) }),
      mockRecommendation({ status: 'ineligible', card: mockCard({ id: '3' }) }),
    ]

    expect(getEligibleCount(recs)).toBe(2)
  })
})

describe('getIneligibleCount', () => {
  it('counts ineligible recommendations', () => {
    const recs = [
      mockRecommendation({ status: 'eligible' }),
      mockRecommendation({ status: 'ineligible', card: mockCard({ id: '2' }) }),
      mockRecommendation({ status: 'ineligible', card: mockCard({ id: '3' }) }),
    ]

    expect(getIneligibleCount(recs)).toBe(2)
  })
})
