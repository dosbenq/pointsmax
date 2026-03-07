import { describe, expect, it } from 'vitest'
import { buildCardSlugById } from './programmatic-content'

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
