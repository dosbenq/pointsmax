import { describe, expect, it } from 'vitest'
import { PROGRAM_GOAL_MAP, formatUsdRounded, yearlyPointsFromSpend } from '@/lib/card-tools'

describe('card-tools', () => {
  it('contains goal mappings for current program slugs used by cards API', () => {
    const requiredSlugs = ['chase-ur', 'amex-mr', 'capital-one', 'citi-thankyou', 'bilt', 'united', 'delta', 'hyatt']

    for (const slug of requiredSlugs) {
      expect(PROGRAM_GOAL_MAP[slug], `missing goal map for slug: ${slug}`).toBeTruthy()
      expect(Array.isArray(PROGRAM_GOAL_MAP[slug])).toBe(true)
    }
  })

  it('formats USD rounded with locale currency style', () => {
    expect(formatUsdRounded(1234.56)).toBe('$1,235')
  })

  it('computes yearly points correctly for india cards with per-100 INR earn units', () => {
    const yearly = yearlyPointsFromSpend({
      monthlySpend: 50000,
      earnMultiplier: 3.33,
      earnUnit: '100_inr',
    })

    expect(yearly).toBeCloseTo(19980, 5)
  })
})
