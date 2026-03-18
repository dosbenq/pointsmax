import { describe, expect, it } from 'vitest'
import { buildBreadcrumbJsonLd, buildCardProductJsonLd, buildFaqJsonLd } from './seo-structured-data'

describe('seo-structured-data', () => {
  it('buildFaqJsonLd returns FAQPage shape', () => {
    const result = buildFaqJsonLd([
      { question: 'Is it worth it?', answer: 'It can be if you use the transfer partners.' },
    ]) as { '@type': string; mainEntity: Array<{ name: string }> }

    expect(result['@type']).toBe('FAQPage')
    expect(result.mainEntity).toHaveLength(1)
    expect(result.mainEntity[0]?.name).toBe('Is it worth it?')
  })

  it('buildBreadcrumbJsonLd returns ordered list items with absolute URLs', () => {
    const result = buildBreadcrumbJsonLd(
      [
        { name: 'Home', url: '/' },
        { name: 'Cards', url: '/us/cards' },
      ],
      'https://pointsmax.com',
    ) as { '@type': string; itemListElement: Array<{ item: string }> }

    expect(result['@type']).toBe('BreadcrumbList')
    expect(result.itemListElement).toHaveLength(2)
    expect(result.itemListElement[0]?.item).toBe('https://pointsmax.com/')
    expect(result.itemListElement[1]?.item).toBe('https://pointsmax.com/us/cards')
  })

  it('buildCardProductJsonLd includes required card product fields', () => {
    const result = buildCardProductJsonLd({
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase',
      description: 'Premium Chase travel card.',
      applyUrl: '/us/cards/chase-sapphire-reserve',
      imageUrl: '/card-art/chase-sapphire-reserve.svg',
      region: 'us',
    }, 'https://pointsmax.com') as { '@type': string; name: string; brand: { name: string } }

    expect(result['@type']).toBe('FinancialProduct')
    expect(result.name).toBe('Chase Sapphire Reserve')
    expect(result.brand.name).toBe('Chase')
  })
})
