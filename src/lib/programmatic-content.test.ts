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

    expect(slugs.get('card-1')).toBe('chase-sapphire-preferred-card-chase')
    expect(slugs.get('card-2')).toBe('chase-sapphire-preferred-card-chase-card2')
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
    expect(resolveProgrammaticCppCents(undefined, 'transferable_points')).toBe(2.00)
    expect(resolveProgrammaticCppCents(undefined, 'airline_miles')).toBe(1.35)
    expect(resolveProgrammaticCppCents(undefined, 'hotel_points')).toBe(0.75)
  })
})

describe('catalog-backed listings', () => {
  it('lists region cards with slugs, programs and values', async () => {
    const { listCardsForRegion, getCardBySlug } = await import('./programmatic-content')
    const cards = await listCardsForRegion('us')
    const sapphire = cards.find((card) => card.name === 'Chase Sapphire Preferred')!
    expect(sapphire.slug).toBe('chase-sapphire-preferred-chase')
    expect(sapphire.program?.slug).toBe('chase-ur')
    expect(sapphire.cpp_cents).toBeGreaterThan(1)
    expect(sapphire.earning_rates.length).toBeGreaterThan(0)
    expect((await getCardBySlug('us', sapphire.slug))?.id).toBe(sapphire.id)
    expect((await listCardsForRegion('in')).every((card) => card.geography === 'IN')).toBe(true)
  })

  it('lists programs with transfer partners and earning cards', async () => {
    const { getProgramBySlug } = await import('./programmatic-content')
    const chase = await getProgramBySlug('us', 'chase-ur')
    expect(chase?.transfer_out.map((partner) => partner.to_program_slug)).toContain('hyatt')
    expect(chase?.earning_cards.map((card) => card.name)).toContain('Chase Sapphire Preferred')
    expect(await getProgramBySlug('us', 'hdfc-millennia')).toBeNull()
  })

  it('serves comparison pages per region', async () => {
    const { getComparisonPageBySlug, listComparisonPagesForRegion } = await import('./programmatic-content')
    expect((await getComparisonPageBySlug('us', 'best-travel-cards-us'))?.cardSlugs).toContain('chase-sapphire-preferred')
    expect((await listComparisonPagesForRegion('in')).every((page) => page.region === 'in')).toBe(true)
  })
})
