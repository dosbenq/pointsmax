import { describe, expect, it } from 'vitest'
import { summarizeBonuses } from './weekly-digest'

describe('weekly-digest helpers', () => {
  it('formats active bonuses for email copy', () => {
    expect(summarizeBonuses([
      {
        bonus_pct: 30,
        from_program_name: 'Amex MR',
        from_program_id: 'amex',
        to_program_name: 'Flying Blue',
      },
    ])).toEqual(['Amex MR → Flying Blue (+30%)'])
  })
})
