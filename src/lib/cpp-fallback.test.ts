import { describe, expect, it } from 'vitest'
import { resolveCppCents } from './cpp-fallback'

describe('resolveCppCents', () => {
  it('prefers the DB valuation when present', () => {
    expect(resolveCppCents(1.7, 'transferable_points', 'chase-ur')).toBe(1.7)
    expect(resolveCppCents('1.25', 'airline_miles', 'united')).toBe(1.25)
  })

  it('uses the per-programme fallback for real DB slugs', () => {
    expect(resolveCppCents(null, 'transferable_points', 'chase-ur')).toBe(2.05)
    expect(resolveCppCents(undefined, 'transferable_points', 'bilt')).toBe(2.2)
    expect(resolveCppCents(0, 'hotel_points', 'hilton')).toBe(0.4)
  })

  it('falls back to the programme-type default for unknown slugs', () => {
    expect(resolveCppCents(null, 'airline_miles', 'not-a-program')).toBe(1.35)
    expect(resolveCppCents(null, 'hotel_points')).toBe(0.75)
  })
})
