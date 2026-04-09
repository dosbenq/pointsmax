import { MetadataRoute } from 'next'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { createServerDbClient } from '@/lib/supabase'
import { listCardsForRegion, listComparisonPagesForRegion } from '@/lib/programmatic-content'

const BASE_URL = getConfiguredAppOrigin()

const REGIONS = ['us', 'in'] as const

type SitemapProgramRow = {
  slug: string
  geography: string | null
}

function isSitemapProgramRow(value: unknown): value is SitemapProgramRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.slug === 'string'
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticRoutes = ['', 'calculator', 'award-search', 'card-recommender', 'earning-calculator', 'hotel-search', 'how-it-works', 'inspire', 'pricing', 'cards', 'cards/compare', 'programs', 'devaluation-tracker', 'privacy', 'terms', 'trip-builder']

  function getRoutePriority(route: string): number {
    if (!route) return 0.95
    if (['calculator', 'award-search', 'card-recommender', 'earning-calculator'].includes(route)) return 0.9
    return 0.7
  }

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
        priority: getRoutePriority(route),
      })
    }
  }

  try {
    const db = createServerDbClient()
    const [cardsByRegion, comparisonPagesByRegion, { data: programs }] = await Promise.all([
      Promise.all(REGIONS.map(async (region) => ({ region, cards: await listCardsForRegion(region) }))),
      Promise.all(REGIONS.map(async (region) => ({ region, pages: await listComparisonPagesForRegion(region) }))),
      db.from('programs').select('slug, geography').eq('is_active', true),
    ])

    const normalizedPrograms = ((programs ?? []) as unknown[]).filter(isSitemapProgramRow)

    for (const entry of cardsByRegion) {
      for (const card of entry.cards) {
        items.push({
          url: `${BASE_URL}/${entry.region}/cards/${card.slug}`,
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.8,
        })
      }
    }

    for (const entry of comparisonPagesByRegion) {
      for (const page of entry.pages) {
        items.push({
          url: `${BASE_URL}/${entry.region}/cards/best/${page.slug}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      }
    }

    for (const program of normalizedPrograms) {
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
