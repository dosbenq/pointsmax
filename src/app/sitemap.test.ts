import { describe, expect, it, vi } from 'vitest'

process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'

vi.mock('@/lib/programmatic-content', () => ({
  listCardsForRegion: async () => [],
  listComparisonPagesForRegion: async (region: 'us' | 'in') => (
    region === 'us'
      ? [{ slug: 'best-travel-cards-us', region: 'us', title: 'Best Travel Cards in the US', description: '', cardSlugs: [], categoryFocus: 'travel', displayOrder: 10 }]
      : [{ slug: 'best-premium-cards-india', region: 'in', title: 'Best Premium Cards in India', description: '', cardSlugs: [], categoryFocus: 'premium', displayOrder: 20 }]
  ),
}))

vi.mock('@/lib/supabase', () => ({
  createServerDbClient: () => ({
    from: () => ({
      select: () => ({
        eq: async () => ({ data: [] }),
      }),
    }),
  }),
}))

const { default: sitemap } = await import('./sitemap')

describe('sitemap', () => {
  it('includes live inspire and earning calculator routes', async () => {
    const items = await sitemap()
    const urls = items.map((item) => item.url)

    expect(urls).toContain('https://pointsmax.com/us/inspire')
    expect(urls).toContain('https://pointsmax.com/in/inspire')
    expect(urls).toContain('https://pointsmax.com/us/earning-calculator')
    expect(urls).toContain('https://pointsmax.com/in/earning-calculator')
    expect(urls).toContain('https://pointsmax.com/us/award-search')
    expect(urls).toContain('https://pointsmax.com/in/award-search')
    expect(urls).toContain('https://pointsmax.com/us/cards/best/best-travel-cards-us')
    expect(urls).toContain('https://pointsmax.com/in/cards/best/best-premium-cards-india')
  })
})
