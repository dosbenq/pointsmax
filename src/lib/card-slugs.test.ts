import { describe, expect, it } from 'vitest'
import { getCanonicalCardSlug, getCardRouteCandidates, matchesCardRouteSlug } from './card-slugs'

describe('card slug helpers', () => {
  const card = {
    id: 'card_123456',
    name: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    program_slug: 'chase-ultimate-rewards',
  }

  it('builds a stable canonical card slug from card identity', () => {
    expect(getCanonicalCardSlug(card)).toBe('chase-sapphire-preferred-chase')
  })

  it('accepts legacy and canonical route candidates', () => {
    expect(getCardRouteCandidates(card)).toEqual(
      new Set([
        'chase-sapphire-preferred-chase',
        'chase-ultimate-rewards',
        'chase-sapphire-preferred',
        'card_123456',
      ]),
    )
  })

  it('matches route slugs case-insensitively', () => {
    expect(matchesCardRouteSlug(card, 'CHASE-SAPPHIRE-PREFERRED-CHASE')).toBe(true)
    expect(matchesCardRouteSlug(card, 'unknown-card')).toBe(false)
  })
})
