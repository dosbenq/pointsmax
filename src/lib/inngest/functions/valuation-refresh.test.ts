import { describe, expect, it } from 'vitest'
import { matchProgram, normalizeProgramName } from './valuation-refresh'

describe('valuation-refresh helpers', () => {
  it('normalizes program names for fuzzy matching', () => {
    expect(normalizeProgramName('British Airways Avios')).toBe('british airways avios')
  })

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
