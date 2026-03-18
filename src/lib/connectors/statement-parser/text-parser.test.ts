import { describe, expect, it } from 'vitest'
import { parseStatementText } from './text-parser'

const programs = [
  { id: 'prog-chase', name: 'Chase Ultimate Rewards', slug: 'chase-ultimate-rewards' },
  { id: 'prog-amex', name: 'Amex Membership Rewards', slug: 'amex-membership-rewards' },
  { id: 'prog-hdfc', name: 'HDFC Reward Points', slug: 'hdfc-reward-points' },
] as const

describe('parseStatementText', () => {
  it('extracts a Chase balance from sample statement text', () => {
    const candidates = parseStatementText(
      'Your Chase Ultimate Rewards Points Balance: 45,234\nStatement closing soon.',
      [...programs],
    )

    expect(candidates).toEqual([
      expect.objectContaining({
        balance: 45234,
        program_id: 'prog-chase',
        program_matched_name: 'Chase Ultimate Rewards',
      }),
    ])
  })

  it('extracts an Amex balance from membership rewards copy', () => {
    const candidates = parseStatementText(
      'Membership Rewards® Points: 87,400',
      [...programs],
    )

    expect(candidates[0]).toEqual(
      expect.objectContaining({
        balance: 87400,
        program_id: 'prog-amex',
        confidence: 'alias',
      }),
    )
  })

  it('handles Indian lakh notation', () => {
    const candidates = parseStatementText(
      'Reward Points available: 1,23,456',
      [...programs],
    )

    expect(candidates[0]?.balance).toBe(123456)
  })

  it('deduplicates repeated program mentions by keeping the higher balance', () => {
    const candidates = parseStatementText(
      'Chase UR Points Balance: 12,000\nChase Ultimate Rewards Balance: 45,234',
      [...programs],
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.balance).toBe(45234)
  })

  it('ignores dollar amounts', () => {
    const candidates = parseStatementText(
      'Rewards earned this month: $452.34\nAnnual fee billed: $95',
      [...programs],
    )

    expect(candidates).toEqual([])
  })

  it('prefers balance-context numbers over larger spend totals', () => {
    const candidates = parseStatementText(
      'HDFC Diners reward points balance: 1,23,456 points (₹ 3,42,000 spend this year)',
      [...programs],
    )

    expect(candidates[0]).toEqual(
      expect.objectContaining({
        balance: 123456,
        program_id: 'prog-hdfc',
      }),
    )
  })
})
