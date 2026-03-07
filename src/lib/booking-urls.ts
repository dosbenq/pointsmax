import { getActiveBookingUrls } from './db/booking-urls'
import { logWarn } from './logger'
import type { BookingUrl } from '@/types/database'

export type BookingLinkCategory = 'hotel_portal' | 'transfer_portal' | 'flight_booking_portal'

export type CategorizedBookingLink = BookingUrl & {
  category: BookingLinkCategory
}

const HOTEL_PORTAL_SLUGS = new Set([
  'hyatt',
  'marriott',
  'hilton',
  'ihg',
  'wyndham',
  'choice',
])

const TRANSFER_PORTAL_SLUGS = new Set([
  'chase-ur',
  'amex-mr',
  'capital-one',
  'citi-thankyou',
  'bilt',
  'hdfc-millennia',
  'sbi-card',
  'axis-edge',
  'icici-rewards',
])

const SLUG_ALIASES: Record<string, string> = {
  'citi-ty': 'citi-thankyou',
}

function normalizeProgramSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug
}

function categorizeBookingLink(programSlug: string): BookingLinkCategory {
  const normalized = normalizeProgramSlug(programSlug)
  if (HOTEL_PORTAL_SLUGS.has(normalized)) return 'hotel_portal'
  if (TRANSFER_PORTAL_SLUGS.has(normalized)) return 'transfer_portal'
  return 'flight_booking_portal'
}

function dedupeBookingUrls(urls: BookingUrl[]): BookingUrl[] {
  const deduped = new Map<string, BookingUrl>()

  for (const row of urls) {
    const normalizedSlug = normalizeProgramSlug(row.program_slug)
    const key = `${normalizedSlug}:${row.region}`
    if (deduped.has(key)) continue
    deduped.set(key, {
      ...row,
      program_slug: normalizedSlug,
    })
  }

  return [...deduped.values()]
}

/**
 * Validates if a string is a valid HTTPS URL.
 */
export function isValidBookingUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function loadValidatedBookingUrls(region?: 'us' | 'in'): Promise<BookingUrl[]> {
  try {
    const dbUrls = await getActiveBookingUrls(region ?? null)
    return dedupeBookingUrls(dbUrls.filter((row) => isValidBookingUrl(row.url)))
  } catch (err) {
    logWarn('booking_urls_unavailable', {
      region: region ?? 'all',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return []
  }
}

/**
 * Get booking URLs formatted for AI prompt.
 * Uses only validated DB-backed URLs. No static fallback.
 */
export async function getBookingUrlsForPrompt(region: 'us' | 'in'): Promise<string> {
  const relevant = await loadValidatedBookingUrls(region)
  if (relevant.length === 0) {
    return 'Known booking URLs: none configured. Do not invent external booking links.'
  }

  const lines = relevant.map((u) => `- ${u.label}: ${u.url}`)
  return `Known booking URLs (only use these exact URLs in links):\n${lines.join('\n')}`
}

/**
 * Get a specific booking URL by program slug.
 * Uses only validated DB-backed URLs. Returns null when unavailable.
 */
export async function getBookingUrl(programSlug: string): Promise<string | null> {
  const normalizedTarget = normalizeProgramSlug(programSlug)
  const all = await loadValidatedBookingUrls()
  const found = all.find((u) => normalizeProgramSlug(u.program_slug) === normalizedTarget)
  return found?.url ?? null
}

export async function getBookingLinks(
  category?: BookingLinkCategory,
  region?: 'us' | 'in',
): Promise<CategorizedBookingLink[]> {
  const all = await loadValidatedBookingUrls(region)
  const categorized = all.map((row) => ({
    ...row,
    category: categorizeBookingLink(row.program_slug),
  }))

  return category
    ? categorized.filter((row) => row.category === category)
    : categorized
}

export async function formatBookingLinksForPrompt(
  category: BookingLinkCategory,
  region?: 'us' | 'in',
): Promise<string> {
  const links = await getBookingLinks(category, region)
  if (links.length === 0) return '- No validated URLs configured'
  return links
    .map((link) => `- ${link.label}: ${link.url}`)
    .join('\n')
}

export async function getTripBuilderPromptSections(region: 'us' | 'in') {
  return {
    hotelBookingUrls: [
      'Known hotel award booking portals (use ONLY these exact URLs for hotel.booking_url):',
      await formatBookingLinksForPrompt('hotel_portal', region),
    ].join('\n'),
    bookingStepUrls: [
      'Known portal URLs (use ONLY these for booking_steps urls, or null if no exact match):',
      await formatBookingLinksForPrompt('transfer_portal', region),
      await formatBookingLinksForPrompt('flight_booking_portal', region),
    ].join('\n'),
  }
}
