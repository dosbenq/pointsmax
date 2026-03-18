import { describe, expect, it } from 'vitest'
import { matchProgram } from './valuation-refresh'

describe('valuation-refresh helpers', () => {
  it('matches extracted names to live program rows', () => {
    const match = matchProgram(
      [
        { id: '1', name: 'British Airways Avios', slug: 'british-airways' },
        { id: '2', name: 'Singapore KrisFlyer', slug: 'singapore' },
      ],
      'Singapore Airlines KrisFlyer',
    )

    expect(match?.id).toBe('2')
  })
})
