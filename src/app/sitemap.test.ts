import { describe, expect, it } from 'vitest'

process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'

const { default: sitemap } = await import('./sitemap')

describe('sitemap', () => {
  it('lists the search home of both regions', async () => {
    const urls = (await sitemap()).map((item) => item.url)

    for (const region of ['us', 'in']) {
      expect(urls).toContain(`https://pointsmax.com/${region}`)
    }
  })

  it('does not list removed pages', async () => {
    const urls = (await sitemap()).map((item) => item.url)
    const removed = ['trip-builder', 'devaluation-tracker', 'inspire', 'cards', 'programs', 'card-recommender', 'earning-calculator', 'hotel-search', 'how-it-works', 'calculator', 'award-search', 'onboarding', 'pricing']

    for (const url of urls) {
      for (const route of removed) {
        expect(url).not.toMatch(new RegExp(`/(us|in)/${route}(/|$)`))
      }
    }
  })
})
