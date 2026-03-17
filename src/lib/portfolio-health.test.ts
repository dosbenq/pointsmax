import { describe, expect, it } from 'vitest'
import { analyzePortfolioHealth } from './portfolio-health'

const programs = [
  { id: 'amex', name: 'Amex MR', type: 'transferable_points' },
  { id: 'delta', name: 'Delta SkyMiles', type: 'airline_miles' },
  { id: 'hyatt', name: 'World of Hyatt', type: 'hotel_points' },
]

describe('analyzePortfolioHealth', () => {
  it('flags over-concentration and missing hotel reach', () => {
    const report = analyzePortfolioHealth(
      [
        { program_id: 'delta', amount: 90000 },
        { program_id: 'amex', amount: 5000 },
      ],
      programs,
      [],
    )

    expect(report.score).toBeLessThan(100)
    expect(report.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'over_concentrated', pct: 95 }),
        expect.objectContaining({ type: 'missing_hotel_program' }),
      ]),
    )
  })

  it('treats a transferable wallet with hotel reach as healthier', () => {
    const report = analyzePortfolioHealth(
      [
        { program_id: 'amex', amount: 60000 },
        { program_id: 'delta', amount: 12000 },
      ],
      programs,
      [{ from_program_id: 'amex', to_program_id: 'hyatt' }],
    )

    expect(report.score).toBeGreaterThanOrEqual(70)
    expect(report.flags).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'missing_hotel_program' })]))
  })

  it('flags stranded balances below redemption thresholds', () => {
    const report = analyzePortfolioHealth(
      [{ program_id: 'delta', amount: 7000 }],
      programs,
      [],
    )

    expect(report.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'stranded_miles',
          program_name: 'Delta SkyMiles',
          minimum_redemption: 10000,
        }),
      ]),
    )
    expect(report.grade).toBe('D')
  })
})
