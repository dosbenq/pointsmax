import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { CardWithRates } from '@/types/database'
import { useCardScorer, useSpendOnlyRanking } from '../application'


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

describe('useCardScorer', () => {
  it('returns empty results when showResults is false', () => {
    const { result } = renderHook(() =>
      useCardScorer({
        cards: [mockCard()],
        spend: {},
        travelGoals: new Set(),
        ownedCards: new Set(),
        regionCode: 'us',
        programGoalMap: {},
        annualFeeTolerance: 'medium',
        mode: 'next_best_card',
        showResults: false,
      })
    )

    expect(result.current.all).toEqual([])
    expect(result.current.visible).toEqual([])
    expect(result.current.blocked).toEqual([])
  })

  it('returns scored and split results when showResults is true', () => {
    const card = mockCard({ id: 'card-1', name: 'Chase Sapphire Preferred', issuer: 'Chase' })
    const { result } = renderHook(() =>
      useCardScorer({
        cards: [card],
        spend: { dining: '1000' },
        travelGoals: new Set(),
        ownedCards: new Set(),
        regionCode: 'us',
        programGoalMap: {},
        annualFeeTolerance: 'medium',
        mode: 'next_best_card',
        showResults: true,
      })
    )

    expect(result.current.all).toHaveLength(1)
    expect(result.current.visible).toHaveLength(1)
    expect(result.current.blocked).toHaveLength(0)
    expect(result.current.all[0].card.id).toBe('card-1')
    expect(result.current.all[0].rank).toBe(1)
  })

  it('splits ineligible cards into blocked list', () => {
    const card = mockCard({ id: 'card-1', name: 'Chase Card', issuer: 'Chase' })
    const { result } = renderHook(() =>
      useCardScorer({
        cards: [card],
        spend: {},
        travelGoals: new Set(),
        ownedCards: new Set(['card-1']), // Card is owned
        regionCode: 'us',
        programGoalMap: {},
        annualFeeTolerance: 'medium',
        mode: 'next_best_card',
        showResults: true,
      })
    )

    expect(result.current.all).toHaveLength(1)
    expect(result.current.visible).toHaveLength(0)
    expect(result.current.blocked).toHaveLength(1)
    expect(result.current.blocked[0].status).toBe('ineligible')
  })

  it('respects mode parameter for scoring', () => {
    const card = mockCard({
      id: 'card-1',
      signup_bonus_pts: 50000,
      annual_fee_usd: 550,
      name: 'Premium Card',
      issuer: 'Amex',
    })

    const { result: nextBestResult } = renderHook(() =>
      useCardScorer({
        cards: [card],
        spend: { dining: '500' },
        travelGoals: new Set(),
        ownedCards: new Set(),
        regionCode: 'us',
        programGoalMap: {},
        annualFeeTolerance: 'high',
        mode: 'next_best_card',
        showResults: true,
      })
    )

    const { result: longTermResult } = renderHook(() =>
      useCardScorer({
        cards: [card],
        spend: { dining: '500' },
        travelGoals: new Set(),
        ownedCards: new Set(),
        regionCode: 'us',
        programGoalMap: {},
        annualFeeTolerance: 'high',
        mode: 'long_term_value',
        showResults: true,
      })
    )

    // Same card should have different scores in different modes
    expect(nextBestResult.current.all[0].breakdown.totalScore).not.toEqual(longTermResult.current.all[0].breakdown.totalScore)
  })
})

describe('useSpendOnlyRanking', () => {
  it('returns empty array when disabled', () => {
    const { result } = renderHook(() =>
      useSpendOnlyRanking({
        cards: [mockCard()],
        spend: {},
        regionCode: 'us',
        enabled: false,
      })
    )

    expect(result.current).toEqual([])
  })

  it('returns ranked cards when enabled', () => {
    const highValueCard = mockCard({
      id: 'high',
      name: 'High Value Card',
      annual_fee_usd: 0,
      earning_rates: { dining: 5, groceries: 5, travel: 5, gas: 5, shopping: 5, streaming: 5, other: 5 },
    })
    const lowValueCard = mockCard({
      id: 'low',
      name: 'Low Value Card',
      annual_fee_usd: 550,
      earning_rates: { dining: 1, groceries: 1, travel: 1, gas: 1, shopping: 1, streaming: 1, other: 1 },
    })

    const { result } = renderHook(() =>
      useSpendOnlyRanking({
        cards: [lowValueCard, highValueCard],
        spend: { dining: '1000' },
        regionCode: 'us',
        enabled: true,
      })
    )

    expect(result.current).toHaveLength(2)
    expect(result.current[0].card.id).toBe('high')
    expect(result.current[1].card.id).toBe('low')
  })

  it('respects limit parameter', () => {
    const cards = [
      mockCard({ id: '1' }),
      mockCard({ id: '2' }),
      mockCard({ id: '3' }),
    ]

    const { result } = renderHook(() =>
      useSpendOnlyRanking({
        cards,
        spend: {},
        regionCode: 'us',
        enabled: true,
        limit: 2,
      })
    )

    expect(result.current).toHaveLength(2)
  })

  it('handles India region correctly', () => {
    const inrCard = mockCard({
      id: 'inr-card',
      currency: 'INR',
      earn_unit: '100_inr',
      earning_rates: { dining: 5, groceries: 1, travel: 1, gas: 1, shopping: 1, streaming: 1, other: 1 },
    })

    const { result } = renderHook(() =>
      useSpendOnlyRanking({
        cards: [inrCard],
        spend: { dining: '10000' },
        regionCode: 'in',
        enabled: true,
      })
    )

    expect(result.current).toHaveLength(1)
    // ₹10000/month / 100 * 5x * 12 months = 6000 points
    expect(result.current[0].pointsPerYear).toBe(6000)
  })
})
