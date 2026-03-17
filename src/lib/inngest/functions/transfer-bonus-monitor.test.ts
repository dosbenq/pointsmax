import { describe, expect, it } from 'vitest'
import { partnerMatchesBonus } from './transfer-bonus-monitor'

describe('transfer-bonus-monitor helpers', () => {
  it('matches extracted bonuses to transfer partner rows', () => {
    expect(partnerMatchesBonus(
      {
        id: 'tp-1',
        from_program: { name: 'American Express Membership Rewards' },
        to_program: { name: 'Air France KLM Flying Blue' },
      },
      {
        from: 'Amex Membership Rewards',
        to: 'Flying Blue',
        bonus_pct: 25,
        end_date: '2026-04-30',
      },
    )).toBe(true)
  })
})
