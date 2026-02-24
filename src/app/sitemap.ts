import { MetadataRoute } from 'next'
import { createServerDbClient } from '@/lib/supabase'
import { slugifyCardName } from '@/lib/programmatic-content'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pointsmax.com'

const REGIONS = ['us', 'in'] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticRoutes = [
    '',
    'calculator',
    'award-search',
    'inspire',
    'trip-builder',
    'card-recommender',
    'earning-calculator',
    'how-it-works',
    'pricing',
    'cards',
    'programs',
  ]

  const items: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 1,
    },
  ]

  for (const region of REGIONS) {
    for (const route of staticRoutes) {
      items.push({
        url: route ? `${BASE_URL}/${region}/${route}` : `${BASE_URL}/${region}`,
        lastModified: now,
        changeFrequency: 'yearly',
        priority: route ? 0.7 : 0.95,
      })
    }
  }

  try {
    const db = createServerDbClient()
    const [{ data: cards }, { data: programs }] = await Promise.all([
      db.from('cards').select('name, geography').eq('is_active', true),
      db.from('programs').select('slug, geography').eq('is_active', true),
    ])

    for (const card of cards ?? []) {
      const region = card.geography === 'IN' ? 'in' : 'us'
      items.push({
        url: `${BASE_URL}/${region}/cards/${slugifyCardName(card.name)}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.8,
      })
    }

    for (const program of programs ?? []) {
      const regions =
        program.geography === 'IN'
          ? ['in']
          : program.geography === 'US'
            ? ['us']
            : ['us', 'in']
      for (const region of regions) {
        items.push({
          url: `${BASE_URL}/${region}/programs/${program.slug}`,
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.8,
        })
      }
    }
  } catch {
    // Keep sitemap generation resilient when DB is unavailable.
  }

  return items
}
