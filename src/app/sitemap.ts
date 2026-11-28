import { MetadataRoute } from 'next'
import { getConfiguredAppOrigin } from '@/lib/app-origin'

const BASE_URL = getConfiguredAppOrigin()

const REGIONS = ['us', 'in'] as const

// Pages per region. Removed pages (cards, programs, hotels, how-it-works…)
// redirect to the region home.
const STATIC_ROUTES = ['', 'calculator', 'award-search', 'pricing', 'privacy', 'terms']

function getRoutePriority(route: string): number {
  if (!route) return 0.95
  if (['calculator', 'award-search'].includes(route)) return 0.9
  return 0.7
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const items: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'yearly', priority: 1 },
  ]

  for (const region of REGIONS) {
    for (const route of STATIC_ROUTES) {
      items.push({
        url: route ? `${BASE_URL}/${region}/${route}` : `${BASE_URL}/${region}`,
        lastModified: now,
        changeFrequency: 'yearly',
        priority: getRoutePriority(route),
      })
    }
  }

  return items
}
