import { MetadataRoute } from 'next'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { createServerDbClient } from '@/lib/supabase'
import { slugifyCardName } from '@/lib/programmatic-content'

const BASE_URL = getConfiguredAppOrigin()

const REGIONS = ['us', 'in'] as const

type SitemapCardRow = {
  name: string
  geography: string | null
}

type SitemapProgramRow = {
  slug: string
  geography: string | null
}

function isSitemapCardRow(value: unknown): value is SitemapCardRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.name === 'string'
}

function isSitemapProgramRow(value: unknown): value is SitemapProgramRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.slug === 'string'
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticRoutes = [
    '',
    'calculator',
    'card-recommender',
    'how-it-works',
    'pricing',
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

    const normalizedCards = ((cards ?? []) as unknown[]).filter(isSitemapCardRow)
    const normalizedPrograms = ((programs ?? []) as unknown[]).filter(isSitemapProgramRow)

    for (const card of normalizedCards) {
      const region = card.geography === 'IN' ? 'in' : 'us'
      items.push({
        url: `${BASE_URL}/${region}/cards/${slugifyCardName(card.name)}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.8,
      })
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
