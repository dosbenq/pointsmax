import { describe, expect, it } from 'vitest'

process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'

const { default: sitemap } = await import('./sitemap')

describe('sitemap', () => {
  it('lists the award search and calculator in both regions', async () => {
    const urls = (await sitemap()).map((item) => item.url)

    for (const region of ['us', 'in']) {
      expect(urls).toContain(`https://pointsmax.com/${region}/award-search`)
      expect(urls).toContain(`https://pointsmax.com/${region}/calculator`)
    }
  })

  it('does not list removed pages', async () => {
    const urls = (await sitemap()).map((item) => item.url)
    const removed = ['trip-builder', 'devaluation-tracker', 'inspire', 'cards', 'programs', 'card-recommender', 'earning-calculator']

    for (const url of urls) {
      for (const route of removed) {
        expect(url).not.toMatch(new RegExp(`/(us|in)/${route}(/|$)`))
      }
    }
  })
})
