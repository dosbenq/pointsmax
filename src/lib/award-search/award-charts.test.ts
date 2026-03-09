import { describe, expect, it } from 'vitest'
import { detectRouteRegion, getEstimatedMiles } from './award-charts'

describe('award charts', () => {
  it('classifies India domestic routes separately', () => {
    expect(detectRouteRegion('DEL', 'BOM')).toBe('domestic_india')
  })

  it('provides India domestic estimates for India-based programs', () => {
    expect(getEstimatedMiles('air-india', 'domestic_india', 'economy', 1)).toBe(7000)
    expect(getEstimatedMiles('indigo-6e', 'domestic_india', 'economy', 2)).toBe(12000)
  })

  it('does not classify India to US routes as Southeast Asia', () => {
    expect(detectRouteRegion('DEL', 'JFK')).toBe('other')
  })

  it('does not pretend to estimate Delta dynamic awards', () => {
    expect(getEstimatedMiles('delta', 'domestic_us', 'economy', 1)).toBeNull()
  })
})
