// ============================================================
// Deep Links — Pre-filled award search URLs per program
// ============================================================

import type { CabinClass, AwardSearchParams } from './types'

interface DeepLink {
  url: string
  label: string
  note?: string
}

type DeepLinkBuilder = (params: AwardSearchParams) => DeepLink

// ── Date format helpers ───────────────────────────────────────

/** YYYY-MM-DD → YYYYMMDD */
function toCompact(date: string): string {
  return date.replace(/-/g, '')
}

/** YYYY-MM-DD → DD Mon YYYY (e.g. "01 Mar 2025") */
function toBAFormat(date: string): string {
  const [y, m, d] = date.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d}${months[parseInt(m, 10) - 1]}${y}`
}

/** CabinClass → United/AA seat map code */
function toCabinCode(cabin: CabinClass, format: 'ua' | 'ba' | 'ac'): string {
  if (format === 'ba') {
    return { economy: 'M', premium_economy: 'W', business: 'C', first: 'F' }[cabin]
  }
  if (format === 'ac') {
    return { economy: 'Economy', premium_economy: 'PremiumEconomy', business: 'Business', first: 'Business' }[cabin]
  }
  // ua / aa: not used in URL, included for completeness
  return { economy: 'economy', premium_economy: 'prem_economy', business: 'business', first: 'first' }[cabin]
}

// ── Fully-parameterized builders ──────────────────────────────

const DEEP_LINK_BUILDERS: Record<string, DeepLinkBuilder> = {
  united: ({ origin, destination, start_date, passengers, cabin }) => ({
    url: `https://www.united.com/en/us/fsr/choose-flights?f=${origin}&t=${destination}&d=${toCompact(start_date)}&tt=1&sc=7&px=${passengers}&taxng=1`,
    label: 'Search on United',
    note: cabin !== 'economy' ? `Select "${cabin === 'business' ? 'Business' : 'First'}" after searching` : undefined,
  }),

  american: ({ origin, destination, start_date, passengers }) => ({
    url: `https://www.aa.com/booking/find-flights?tripType=oneWay&sliceIndex=0&passengers.adultCount=${passengers}&segments[0].origin=${origin}&segments[0].destination=${destination}&segments[0].travelDate=${start_date}&bookingType=award`,
    label: 'Search on American',
  }),

  aeroplan: ({ origin, destination, start_date, passengers }) => ({
    url: `https://www.aeroplan.com/en/use-your-miles/travel.html?org0=${origin}&dest0=${destination}&departureDate0=${start_date}&ADT=${passengers}&YTH=0&CHD=0&INF=0&INS=0&tripType=O`,
    label: 'Search on Aeroplan',
  }),

  'british-airways': ({ origin, destination, start_date, passengers, cabin }) => ({
    url: `https://www.britishairways.com/travel/redeem/execclub/?departurePoint=${origin}&destinationPoint=${destination}&departureDate=${toBAFormat(start_date)}&cabin=${toCabinCode(cabin, 'ba')}&adultCount=${passengers}`,
    label: 'Search on British Airways',
  }),

  delta: ({ origin, destination, start_date, passengers }) => ({
    url: `https://www.delta.com/us/en/flight-search/book-a-flight#/search/oneWay/${origin}/${destination}/${start_date}/ADT${passengers}/award/lowest`,
    label: 'Search on Delta',
    note: 'Delta uses dynamic pricing — rates vary by date',
  }),

  // ── Landing-page only (no reliable deep-param support) ──────

  'flying-blue': () => ({
    url: 'https://www.flyingblue.com',
    label: 'Search on Flying Blue',
    note: 'Enter dates manually on the site',
  }),

  singapore: () => ({
    url: 'https://www.singaporeair.com/en_UK/us/home',
    label: 'Search on KrisFlyer',
    note: 'Enter dates manually on the site',
  }),

  ana: () => ({
    url: 'https://www.ana.co.jp/en/us/amc/',
    label: 'Search on ANA',
    note: 'Enter dates manually on the site',
  }),

  turkish: () => ({
    url: 'https://www.turkishairlines.com/en-int/miles-and-smiles/',
    label: 'Search on Miles&Smiles',
    note: 'Enter dates manually on the site',
  }),

  avianca: () => ({
    url: 'https://www.lifemiles.com',
    label: 'Search on LifeMiles',
    note: 'Enter dates manually on the site',
  }),

  emirates: () => ({
    url: 'https://www.emirates.com/us/english/skywards/',
    label: 'Search on Emirates',
    note: 'Enter dates manually on the site',
  }),

  'virgin-atlantic': () => ({
    url: 'https://www.virginatlantic.com/us/en/flying-club.html',
    label: 'Search on Virgin Atlantic',
    note: 'Enter dates manually on the site',
  }),

  cathay: () => ({
    url: 'https://www.cathaypacific.com/cx/en_US/membership.html',
    label: 'Search on Asia Miles',
    note: 'Enter dates manually on the site',
  }),

  iberia: () => ({
    url: 'https://www.iberia.com/us/iberiaplus/',
    label: 'Search on Iberia',
    note: 'Enter dates manually on the site',
  }),

  'aer-lingus': () => ({
    url: 'https://www.aerlingus.com/en-us/',
    label: 'Search on Aer Lingus',
    note: 'Enter dates manually on the site',
  }),

  etihad: () => ({
    url: 'https://www.etihad.com/en/etihadguest',
    label: 'Search on Etihad',
    note: 'Enter dates manually on the site',
  }),

  alaska: () => ({
    url: 'https://www.alaskaair.com/content/mileage-plan',
    label: 'Search on Alaska',
    note: 'Enter dates manually on the site',
  }),

  jetblue: () => ({
    url: 'https://www.jetblue.com/trueblue',
    label: 'Search on JetBlue',
    note: 'Enter dates manually on the site',
  }),

  hawaiian: () => ({
    url: 'https://www.hawaiianairlines.com/',
    label: 'Search on Hawaiian',
    note: 'Enter dates manually on the site',
  }),

  southwest: () => ({
    url: 'https://www.southwest.com/air/booking/',
    label: 'Search on Southwest',
    note: 'Enter dates manually on the site',
  }),
}

// ── Public API ────────────────────────────────────────────────

export function buildDeepLink(slug: string, params: AwardSearchParams): DeepLink {
  const builder = DEEP_LINK_BUILDERS[slug]
  if (builder) return builder(params)
  return {
    url: 'https://www.google.com/travel/flights',
    label: 'Search flights',
    note: 'Check airline website directly',
  }
}
