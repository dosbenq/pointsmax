import { describe, expect, it, vi } from 'vitest'

process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'

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
  it('does not include redirected legacy feature routes', async () => {
    const items = await sitemap()
    const urls = items.map((item) => item.url)

    expect(urls).not.toContain('https://pointsmax.com/us/inspire')
    expect(urls).not.toContain('https://pointsmax.com/in/inspire')
    expect(urls).not.toContain('https://pointsmax.com/us/earning-calculator')
    expect(urls).not.toContain('https://pointsmax.com/in/earning-calculator')
  })
})
