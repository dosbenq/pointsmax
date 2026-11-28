import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCatalogCards } from '@/lib/catalog'
import { CARD_ART_MAP } from '@/lib/card-tools'
import { getRegionSwitchHref } from '@/lib/regions'

describe('getRegionSwitchHref', () => {
  it('keeps the same page when it exists in both regions', () => {
    expect(getRegionSwitchHref('/us/calculator', 'in')).toBe('/in/calculator')
    expect(getRegionSwitchHref('/in/award-search', 'us')).toBe('/us/award-search')
    expect(getRegionSwitchHref('/us', 'in')).toBe('/in')
    expect(getRegionSwitchHref('/us/cards', 'in')).toBe('/in/cards')
  })

  it("sends card, program and comparison pages to the other region's list (they differ per region)", () => {
    expect(getRegionSwitchHref('/us/cards/chase-sapphire-preferred-chase', 'in')).toBe('/in/cards')
    expect(getRegionSwitchHref('/us/cards/best/best-travel-cards-us', 'in')).toBe('/in/cards')
    expect(getRegionSwitchHref('/in/programs/hdfc-millennia', 'us')).toBe('/us/programs')
    expect(getRegionSwitchHref('/us/trips/abc123', 'in')).toBe('/in')
  })

  it('goes to the region home from pages outside a region', () => {
    expect(getRegionSwitchHref('/profile', 'in')).toBe('/in')
  })
})

describe('CARD_ART_MAP', () => {
  it('points only at cards in the catalog and at files that exist', () => {
    const names = new Set(getCatalogCards({ includeInactive: true }).map((card) => card.name))
    for (const [name, src] of Object.entries(CARD_ART_MAP)) {
      expect(names.has(name), `${name} is not a catalog card`).toBe(true)
      expect(src.startsWith('/card-art/'), `${name} must be self-hosted`).toBe(true)
      expect(fs.existsSync(path.join(process.cwd(), 'public', src)), `${src} is missing`).toBe(true)
    }
  })
})
