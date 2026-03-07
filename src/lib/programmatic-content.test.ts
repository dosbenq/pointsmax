import { describe, expect, it } from 'vitest'
import { buildCardSlugById, resolveProgrammaticCppCents } from './programmatic-content'
import { REGIONS } from './regions'

describe('buildCardSlugById', () => {
  it('keeps the base slug for the first card and disambiguates collisions', () => {
    const slugs = buildCardSlugById([
      { id: 'card-1', name: 'Chase Sapphire Preferred Card', issuer: 'Chase' },
      { id: 'card-2', name: 'Chase Sapphire Preferred Card', issuer: 'Chase' },
      { id: 'card-3', name: 'Chase Sapphire Preferred Card', issuer: 'Chase' },
    ])

    expect(slugs.get('card-1')).toBe('chase-sapphire-preferred-card')
    expect(slugs.get('card-2')).toBe('chase-sapphire-preferred-card-chase')
    expect(slugs.get('card-3')).toBe('chase-sapphire-preferred-card-chase-card3')
  })
})

describe('region defaults', () => {
  it('includes a default shopping spend for the US region', () => {
    expect(REGIONS.us.defaultSpend.shopping).toBe('500')
  })
})

describe('resolveProgrammaticCppCents', () => {
  it('uses per-type defaults when no valuation exists', () => {
    expect(resolveProgrammaticCppCents(undefined, 'transferable_points')).toBe(1.6)
    expect(resolveProgrammaticCppCents(undefined, 'airline_miles')).toBe(1.2)
    expect(resolveProgrammaticCppCents(undefined, 'hotel_points')).toBe(0.8)
  })
})
