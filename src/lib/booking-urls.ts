/**
 * Booking URLs configuration for AI recommendations.
 * 
 * TODO: Q8 - Move to database table `booking_urls`:
 * - id: uuid
 * - program_slug: string (e.g., 'chase-ur', 'amex-mr', 'hyatt')
 * - label: string (e.g., 'Chase UR transfer partners')
 * - url: string
 * - region: 'us' | 'in' | 'global'
 * - sort_order: number
 * - is_active: boolean
 * - created_at: timestamp
 * 
 * Migration path:
 * 1. Create table via Supabase migration
 * 2. Add API endpoint to fetch active URLs
 * 3. Update ai/recommend to fetch from API/cache
 * 4. Remove this hardcoded list
 */

import { getActiveBookingUrls } from './db/booking-urls'

export interface BookingUrl {
  program_slug: string
  label: string
  url: string
  region: 'us' | 'in' | 'global'
}

// Hardcoded booking URLs - to be moved to DB as per Q8
export const BOOKING_URLS: BookingUrl[] = [
  // US transferable currencies
  { program_slug: 'chase-ur', label: 'Chase UR transfer partners', url: 'https://www.ultimaterewards.com', region: 'us' },
  { program_slug: 'amex-mr', label: 'Amex MR transfer partners', url: 'https://global.americanexpress.com/rewards/transfer', region: 'us' },
  { program_slug: 'capital-one', label: 'Capital One transfer partners', url: 'https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/', region: 'us' },
  { program_slug: 'citi-ty', label: 'Citi ThankYou transfer partners', url: 'https://www.citi.com/credit-cards/thankyou-rewards', region: 'us' },
  { program_slug: 'bilt', label: 'Bilt transfer partners', url: 'https://www.bilt.com/rewards/travel', region: 'us' },
  
  // India transferable currencies
  { program_slug: 'hdfc-millennia', label: 'HDFC Millennia portal', url: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards', region: 'in' },
  { program_slug: 'sbi-card', label: 'SBI Card rewards', url: 'https://www.sbicard.com/en/personal/rewards.page', region: 'in' },
  { program_slug: 'axis-edge', label: 'Axis Edge Rewards', url: 'https://www.axisbank.com/retail/cards/edge-rewards', region: 'in' },
  { program_slug: 'icici-rewards', label: 'ICICI Rewards', url: 'https://www.icicibank.com/personal-banking/cards/credit-card', region: 'in' },
  
  // Hotel programs - global
  { program_slug: 'hyatt', label: 'Hyatt award search', url: 'https://world.hyatt.com/content/gp/en/rewards/free-nights-upgrades.html', region: 'global' },
  { program_slug: 'marriott', label: 'Marriott Bonvoy award search', url: 'https://www.marriott.com/loyalty/redeem.mi', region: 'global' },
  { program_slug: 'hilton', label: 'Hilton Honors award search', url: 'https://www.hilton.com/en/hilton-honors/points/', region: 'global' },
  { program_slug: 'ihg', label: 'IHG One Rewards award search', url: 'https://www.ihg.com/onerewards/content/us/en/redeem-rewards', region: 'global' },
  
  // Airline programs - global
  { program_slug: 'united', label: 'United MileagePlus award search', url: 'https://www.united.com/en/us/fly/travel/awards.html', region: 'global' },
  { program_slug: 'delta', label: 'Delta SkyMiles award search', url: 'https://www.delta.com/us/en/skymiles/overview', region: 'global' },
  { program_slug: 'american', label: 'American AAdvantage award search', url: 'https://www.aa.com/homePage.do', region: 'global' },
  { program_slug: 'flying-blue', label: 'Air France/KLM Flying Blue', url: 'https://www.flyingblue.com/en/spend/flights', region: 'global' },
  { program_slug: 'british-airways', label: 'British Airways Avios', url: 'https://www.britishairways.com/travel/home/public/en_us/', region: 'global' },
  { program_slug: 'aeroplan', label: 'Air Canada Aeroplan', url: 'https://www.aircanada.com/ca/en/aco/home/aeroplan.html', region: 'global' },
  { program_slug: 'krisflyer', label: 'Singapore KrisFlyer', url: 'https://www.singaporeair.com/en_UK/us/home', region: 'global' },
  { program_slug: 'turkish', label: 'Turkish Miles&Smiles', url: 'https://www.turkishairlines.com/en-int/miles-and-smiles/', region: 'global' },
  { program_slug: 'lifemiles', label: 'Avianca LifeMiles', url: 'https://www.lifemiles.com/fly/search', region: 'global' },
]

/**
 * Get booking URLs formatted for AI prompt.
 * Filters by region and returns as formatted string.
 * Attempts to load from DB, falls back to static map.
 */
export async function getBookingUrlsForPrompt(region: 'us' | 'in'): Promise<string> {
  let urls: BookingUrl[] = BOOKING_URLS
  
  try {
    const dbUrls = await getActiveBookingUrls(region)
    if (dbUrls && dbUrls.length > 0) {
      urls = dbUrls.map(u => ({
        program_slug: u.program_slug,
        label: u.label,
        url: u.url,
        region: u.region as 'us' | 'in' | 'global'
      }))
    }
  } catch {
    // Silent fallback to static map
  }

  const relevant = urls.filter(
    u => u.region === region || u.region === 'global'
  )
  
  const lines = relevant.map(u => `- ${u.label}: ${u.url}`)
  
  return `Known booking URLs (only use these exact URLs in links):\n${lines.join('\n')}`
}

/**
 * Get a specific booking URL by program slug.
 * Attempts to load from DB, falls back to static map.
 */
export async function getBookingUrl(programSlug: string): Promise<string | null> {
  try {
    const dbUrls = await getActiveBookingUrls()
    const found = dbUrls.find(u => u.program_slug === programSlug)
    if (found) return found.url
  } catch {
    // Silent fallback
  }

  const found = BOOKING_URLS.find(u => u.program_slug === programSlug)
  return found?.url ?? null
}
