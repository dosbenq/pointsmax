// ============================================================
// Award Charts — Static saver rates per program × route region
// All rates are per-person one-way estimates based on published
// award charts. Used when real availability data isn't available.
// ============================================================

import type { CabinClass, RouteRegion } from './types'

// ── IATA airport sets by region ──────────────────────────────

const DOMESTIC_US = new Set([
  'JFK', 'LGA', 'EWR', 'LAX', 'SFO', 'ORD', 'MDW', 'DFW', 'DAL', 'ATL',
  'MIA', 'FLL', 'MCO', 'TPA', 'BOS', 'DEN', 'LAS', 'PHX', 'SEA', 'PDX',
  'DTW', 'MSP', 'MSY', 'HOU', 'IAH', 'DCA', 'IAD', 'BWI', 'CLT', 'PHL',
  'SAN', 'SLC', 'AUS', 'BNA', 'RDU', 'STL', 'MCI', 'IND', 'PIT', 'CVG',
  'RSW', 'PBI', 'JAX', 'SAV', 'CHS', 'ABQ', 'ELP', 'OKC', 'OMA', 'DSM',
  'GRR', 'CLE', 'BUF', 'ALB', 'SYR', 'ROC', 'PVD', 'BDL', 'MHT', 'PWM',
  'HNL', 'OGG', 'KOA', 'LIH', 'ANC', 'FAI', 'OAK', 'SJC', 'BUR', 'LGB',
  'SNA', 'ONT', 'SMF', 'SBA', 'SBP', 'MRY', 'RNO', 'BOI', 'GEG', 'MSO',
  'BZN', 'JAC', 'SUN', 'TWF', 'PIH', 'LWS', 'EUG', 'MFR', 'RDM', 'ASE',
  'DRO', 'GJT', 'MTJ', 'COS', 'PUB', 'GUC', 'HDN', 'TEX', 'CEZ',
])

const CANADA_MEXICO = new Set([
  'YYZ', 'YVR', 'YUL', 'YYC', 'YEG', 'YOW', 'YHZ', 'YWG', 'YQR', 'YXE',
  'YYJ', 'YKF', 'YLW', 'YQB', 'YFC', 'YQM', 'YGK', 'YYT',
  'MEX', 'CUN', 'GDL', 'MTY', 'MID', 'SJD', 'ZIH', 'PVR', 'MZT', 'BJX',
  'HMO', 'OAX', 'AGU', 'TRC', 'ZCL', 'CJS', 'TAM', 'VER', 'VSA', 'CME',
])

const CARIBBEAN = new Set([
  'MBJ', 'KIN', 'NAS', 'GGT', 'ELH', 'FPO', 'SJU', 'BQN', 'MAZ',
  'STT', 'STX', 'STJ', 'SDQ', 'PUJ', 'STI', 'AUA', 'CUR', 'BON',
  'BGI', 'GCM', 'GND', 'SVD', 'UVF', 'AXA', 'SKB', 'NEV',
  'TAB', 'POS', 'HAV', 'VRA', 'HOG', 'CCC', 'SXM', 'SFG',
  'FDF', 'PTP', 'SBH', 'TER', 'FNC', 'PDL',
])

const INDIA = new Set([
  'DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU', 'COK', 'AMD', 'PNQ', 'GOI',
  'JAI', 'LKO', 'IXC', 'TRV', 'IXM', 'VTZ', 'BBI', 'NAG', 'PAT', 'GAU',
  'IXB', 'SXR', 'ATQ', 'IXA', 'RAJ', 'UDR', 'IDR', 'JDH', 'CCJ',
])

const EUROPE = new Set([
  'LHR', 'LGW', 'STN', 'LCY', 'LTN', 'MAN', 'EDI', 'GLA', 'BHX', 'BRS',
  'CDG', 'ORY', 'NCE', 'MRS', 'LYS', 'TLS', 'BOD', 'NTE', 'SXB',
  'FRA', 'MUC', 'TXL', 'BER', 'HAM', 'DUS', 'CGN', 'STR', 'NUE', 'HAJ',
  'AMS', 'RTM', 'EIN',
  'MAD', 'BCN', 'AGP', 'SVQ', 'VLC', 'BIO', 'LPA', 'TFS', 'PMI',
  'FCO', 'CIA', 'MXP', 'LIN', 'VCE', 'NAP', 'PMO', 'CTA', 'BRI', 'VRN',
  'ZRH', 'GVA', 'BSL',
  'VIE', 'SZG', 'GRZ', 'INN',
  'BRU', 'CRL',
  'LIS', 'OPO', 'FAO',
  'DUB', 'SNN', 'ORK',
  'ARN', 'GOT', 'MMX',
  'CPH', 'AAL', 'BLL',
  'OSL', 'BGO', 'TRD', 'SVG',
  'HEL', 'TMP', 'TKU',
  'ATH', 'SKG', 'HER', 'RHO',
  'IST', 'SAW', 'ESB', 'ADB', 'AYT',
  'WAW', 'KRK', 'GDN', 'POZ', 'WRO',
  'PRG', 'BRQ',
  'BUD', 'DEB',
  'SOF', 'PDV',
  'OTP', 'CLJ', 'TSR',
  'KBP', 'LWO', 'ODS',
  'SVO', 'DME', 'SHE', 'LED', 'SVX',
  'RIX', 'TLL', 'VNO',
  'ZAG', 'DBV', 'SPU',
  'SKP', 'BEG', 'LJU',
  'TIV', 'TGD', 'SKP',
  'TIA', 'PRN', 'MSQ', 'KIV',
  'RKV', 'KEF',
  'TRF',
])

const MIDDLE_EAST = new Set([
  'DXB', 'DWC', 'DOH', 'AUH', 'SHJ', 'RKT', 'FJR',
  'CAI', 'HRG', 'SSH', 'LXR', 'ASW',
  'AMM', 'AQJ',
  'BEY',
  'BAH',
  'KWI',
  'MCT', 'SLL', 'MSH',
  'TLV', 'ETH',
  'RUH', 'JED', 'MED', 'DMM', 'AHB', 'TIF', 'GIZ',
  'ADE', 'SAH',
  'BGW', 'BSR', 'EBL',
  'THR', 'MHD', 'IFN', 'SYZ', 'IKA',
])

const JAPAN_KOREA = new Set([
  'NRT', 'HND', 'KIX', 'NGO', 'CTS', 'OKA', 'FUK', 'ITM',
  'HIJ', 'KOJ', 'KMI', 'OIT', 'MYJ', 'TAK', 'TKS',
  'ICN', 'GMP', 'PUS', 'CJU', 'KWJ', 'TAE', 'RSU', 'CJJ',
])

const SE_ASIA = new Set([
  'HKG', 'MFM',
  'BKK', 'DMK', 'HKT', 'CNX', 'CEI', 'USM', 'KBV', 'UTP',
  'SIN',
  'KUL', 'PEN', 'LGK', 'BKI', 'KCH', 'MYY', 'SZB',
  'MNL', 'CEB', 'DVO', 'CRK', 'ILO', 'KLO',
  'CGK', 'DPS', 'SUB', 'UPG', 'PLM', 'BTH', 'MDC', 'SOC', 'JOG',
  'SGN', 'HAN', 'DAD', 'VCA', 'VII', 'HPH',
  'PNH', 'REP',
  'VTE', 'LPQ',
  'RGN', 'MDL',
  'CCU', 'MAA', 'BOM', 'DEL', 'BLR', 'HYD', 'COK', 'AMD', 'PNQ', 'GOI',
  'CMB', 'HRI',
  'MLE',
  'DAC', 'CXB',
  'KTM',
])

const AUSTRALIA = new Set([
  'SYD', 'MEL', 'BNE', 'PER', 'ADL', 'CBR', 'DRW', 'OOL', 'CNS',
  'TSV', 'MKY', 'ROK', 'BHQ', 'NTL', 'MEL', 'AVV', 'LST', 'HBA',
  'AKL', 'WLG', 'CHC', 'ZQN', 'DUD', 'NPE', 'NSN',
  'NAN', 'SUV', 'APW', 'PPT', 'RAR', 'TBU', 'INU',
])

const SOUTH_AMERICA = new Set([
  'GRU', 'GIG', 'BSB', 'FOR', 'SSA', 'REC', 'POA', 'CWB', 'CNF', 'MCZ',
  'MAO', 'BEL', 'THE', 'SLZ', 'JPA', 'NAT', 'CGH', 'VCP', 'SDU',
  'EZE', 'AEP', 'COR', 'MDZ', 'BRC', 'CPC', 'IGR', 'SDE',
  'SCL', 'PMC', 'IQQ', 'ANF', 'CJC', 'ARI', 'IPC',
  'BOG', 'MDE', 'CTG', 'CLO', 'BAQ', 'SMR', 'PEI', 'BGA', 'EOH', 'ADZ',
  'LIM', 'CUZ', 'AQP', 'TRU', 'IQT', 'PIU',
  'UIO', 'GYE', 'CUE',
  'CCS', 'MAR', 'BLA', 'PMV',
  'MVD', 'PDP',
  'ASU', 'CDE',
  'LPB', 'VVI', 'CBB', 'SRE', 'TJA',
  'GBE',
  'GEO',
  'PBM',
  'CAY',
])

// ── Route region detection ────────────────────────────────────

export function detectRouteRegion(origin: string, destination: string): RouteRegion {
  const o = origin.toUpperCase().trim()
  const d = destination.toUpperCase().trim()

  // Domestic: both airports in US
  if (DOMESTIC_US.has(o) && DOMESTIC_US.has(d)) return 'domestic_us'
  if (INDIA.has(o) && INDIA.has(d)) return 'domestic_india'

  // Region primarily based on destination, with domestic overrides above.
  if (CANADA_MEXICO.has(d)) return 'canada_mexico'
  if (CARIBBEAN.has(d)) return 'caribbean'
  if (EUROPE.has(d)) return 'europe'
  if (MIDDLE_EAST.has(d)) return 'middle_east'
  if (JAPAN_KOREA.has(d)) return 'japan_korea'
  if (SE_ASIA.has(d)) return 'se_asia'
  if (AUSTRALIA.has(d)) return 'australia'
  if (SOUTH_AMERICA.has(d)) return 'south_america'

  // Also check origin if destination is domestic (user flying back)
  if (DOMESTIC_US.has(d)) {
    if (CANADA_MEXICO.has(o)) return 'canada_mexico'
    if (CARIBBEAN.has(o)) return 'caribbean'
    if (EUROPE.has(o)) return 'europe'
    if (MIDDLE_EAST.has(o)) return 'middle_east'
    if (JAPAN_KOREA.has(o)) return 'japan_korea'
    if (SE_ASIA.has(o)) return 'se_asia'
    if (AUSTRALIA.has(o)) return 'australia'
    if (SOUTH_AMERICA.has(o)) return 'south_america'
  }

  return 'other'
}

// ── Award charts ──────────────────────────────────────────────
// Per-person, one-way estimated saver rates in miles/points.
// Multiply by passengers in the caller.

type CabinRates = Partial<Record<CabinClass, number>>
type RegionRates = Partial<Record<RouteRegion, CabinRates>>

const AWARD_CHARTS: Record<string, RegionRates> = {
  united: {
    domestic_us:   { economy: 12500, business: 25000, first: 40000 },
    canada_mexico: { economy: 15000, premium_economy: 20000, business: 30000 },
    caribbean:     { economy: 17500, business: 35000 },
    europe:        { economy: 30000, premium_economy: 55000, business: 70000, first: 110000 },
    middle_east:   { economy: 42500, business: 85000, first: 115000 },
    japan_korea:   { economy: 35000, premium_economy: 55000, business: 70000, first: 110000 },
    se_asia:       { economy: 35000, premium_economy: 55000, business: 80000, first: 120000 },
    australia:     { economy: 40000, premium_economy: 65000, business: 80000, first: 130000 },
    south_america: { economy: 30000, business: 68000 },
  },
  american: {
    domestic_us:   { economy: 12500, business: 25000, first: 35000 },
    canada_mexico: { economy: 15000, business: 30000 },
    caribbean:     { economy: 17500, business: 35000 },
    europe:        { economy: 30000, premium_economy: 50000, business: 57500, first: 85000 },
    middle_east:   { economy: 40000, business: 70000, first: 100000 },
    japan_korea:   { economy: 35000, premium_economy: 55000, business: 60000, first: 110000 },
    se_asia:       { economy: 40000, business: 70000 },
    australia:     { economy: 40000, business: 80000 },
    south_america: { economy: 30000, business: 55000 },
  },
  alaska: {
    domestic_us:   { economy: 10000, business: 20000, first: 30000 },
    canada_mexico: { economy: 12500, business: 25000 },
    caribbean:     { economy: 17500, business: 35000 },
    europe:        { economy: 25000, business: 50000 },
    middle_east:   { economy: 35000, business: 70000 },
    japan_korea:   { economy: 30000, business: 50000 },
    se_asia:       { economy: 30000, business: 50000 },
    australia:     { economy: 35000, business: 65000 },
    south_america: { economy: 30000, business: 50000 },
  },
  aeroplan: {
    domestic_us:   { economy: 12500, business: 25000 },
    canada_mexico: { economy: 15000, business: 30000 },
    caribbean:     { economy: 17500, business: 35000 },
    europe:        { economy: 30000, premium_economy: 45000, business: 55000, first: 85000 },
    middle_east:   { economy: 40000, business: 75000 },
    japan_korea:   { economy: 35000, premium_economy: 55000, business: 65000, first: 100000 },
    se_asia:       { economy: 35000, premium_economy: 55000, business: 65000 },
    australia:     { economy: 40000, business: 70000 },
    south_america: { economy: 30000, business: 60000 },
  },
  'british-airways': {
    domestic_us:   { economy: 7500, business: 15000 },
    canada_mexico: { economy: 9000, business: 18000 },
    caribbean:     { economy: 9000, business: 18000 },
    europe:        { economy: 13000, premium_economy: 25000, business: 26000, first: 50000 },
    middle_east:   { economy: 25000, business: 50000 },
    japan_korea:   { economy: 40000, premium_economy: 80000, business: 80000, first: 120000 },
    se_asia:       { economy: 30000, business: 60000 },
    australia:     { economy: 40000, business: 80000 },
    south_america: { economy: 25000, business: 50000 },
  },
  'flying-blue': {
    domestic_us:   { economy: 10000, business: 20000 },
    canada_mexico: { economy: 12000, business: 24000 },
    caribbean:     { economy: 12000, business: 24000 },
    europe:        { economy: 18000, premium_economy: 30000, business: 50000 },
    middle_east:   { economy: 30000, business: 60000 },
    japan_korea:   { economy: 35000, business: 80000 },
    se_asia:       { economy: 30000, business: 70000 },
    australia:     { economy: 40000, business: 80000 },
    south_america: { economy: 25000, business: 55000 },
  },
  'air-india': {
    domestic_india: { economy: 7000, business: 16000 },
    middle_east: { economy: 18000, business: 35000 },
    europe: { economy: 25000, business: 55000, first: 85000 },
    se_asia: { economy: 14000, business: 28000 },
    other: { economy: 20000, business: 45000 },
  },
  'indigo-6e': {
    domestic_india: { economy: 6000 },
    se_asia: { economy: 12000 },
    middle_east: { economy: 18000 },
  },
  singapore: {
    domestic_us:   { economy: 22500, business: 45000 },
    canada_mexico: { economy: 22500, business: 45000 },
    caribbean:     { economy: 22500, business: 45000 },
    europe:        { economy: 40000, premium_economy: 65000, business: 90000, first: 130000 },
    middle_east:   { economy: 35000, business: 87500 },
    japan_korea:   { economy: 17500, business: 47500, first: 95000 },
    se_asia:       { economy: 17500, business: 37500, first: 75000 },
    australia:     { economy: 25000, business: 62500 },
    south_america: { economy: 45000, business: 90000 },
  },
  ana: {
    domestic_us:   { economy: 22000, business: 44000 },
    canada_mexico: { economy: 22000, business: 44000 },
    caribbean:     { economy: 22000, business: 44000 },
    europe:        { economy: 45000, business: 88000, first: 110000 },
    middle_east:   { economy: 40000, business: 80000 },
    japan_korea:   { economy: 17000, business: 38000, first: 55000 },
    se_asia:       { economy: 17000, business: 38000, first: 75000 },
    australia:     { economy: 30000, business: 68000 },
    south_america: { economy: 55000, business: 110000 },
  },
  turkish: {
    domestic_us:   { economy: 10000, business: 20000 },
    canada_mexico: { economy: 12500, business: 25000 },
    caribbean:     { economy: 12500, business: 25000 },
    europe:        { economy: 10000, business: 15000 },
    middle_east:   { economy: 12500, business: 22500 },
    japan_korea:   { economy: 15000, business: 27500 },
    se_asia:       { economy: 15000, business: 27500 },
    australia:     { economy: 20000, business: 37500 },
    south_america: { economy: 15000, business: 30000 },
  },
  avianca: {
    domestic_us:   { economy: 7500, business: 15000 },
    canada_mexico: { economy: 10000, business: 22500 },
    caribbean:     { economy: 10000, business: 22500 },
    europe:        { economy: 25000, business: 50000 },
    middle_east:   { economy: 30000, business: 60000 },
    japan_korea:   { economy: 35000, business: 65000 },
    se_asia:       { economy: 30000, business: 60000 },
    australia:     { economy: 40000, business: 75000 },
    south_america: { economy: 12500, business: 25000 },
  },
  emirates: {
    domestic_us:   { economy: 15000, business: 30000 },
    canada_mexico: { economy: 17500, business: 35000 },
    caribbean:     { economy: 17500, business: 35000 },
    europe:        { economy: 26250, business: 57750, first: 86625 },
    middle_east:   { economy: 20000, business: 42500, first: 67500 },
    japan_korea:   { economy: 40000, business: 75000, first: 115000 },
    se_asia:       { economy: 30000, business: 62500 },
    australia:     { economy: 40000, business: 75000, first: 115000 },
    south_america: { economy: 35000, business: 70000 },
  },
  'virgin-atlantic': {
    domestic_us:   { economy: 12500, business: 25000 },
    canada_mexico: { economy: 15000, business: 30000 },
    caribbean:     { economy: 15000, business: 30000 },
    europe:        { economy: 20000, premium_economy: 35000, business: 50000, first: 95000 },
    middle_east:   { economy: 30000, business: 60000 },
    japan_korea:   { economy: 30000, premium_economy: 60000, business: 50000, first: 120000 },
    se_asia:       { economy: 25000, business: 47500 },
    australia:     { economy: 35000, business: 70000 },
    south_america: { economy: 25000, business: 50000 },
  },
  cathay: {
    domestic_us:   { economy: 20000, business: 40000 },
    canada_mexico: { economy: 20000, business: 40000 },
    caribbean:     { economy: 20000, business: 40000 },
    europe:        { economy: 35000, premium_economy: 60000, business: 75000, first: 110000 },
    middle_east:   { economy: 30000, business: 60000 },
    japan_korea:   { economy: 15000, business: 35000, first: 70000 },
    se_asia:       { economy: 15000, business: 30000, first: 60000 },
    australia:     { economy: 25000, business: 55000 },
    south_america: { economy: 40000, business: 80000 },
  },
  iberia: {
    domestic_us:   { economy: 12500, business: 25000 },
    canada_mexico: { economy: 15000, business: 30000 },
    caribbean:     { economy: 15000, business: 30000 },
    europe:        { economy: 13500, premium_economy: 27000, business: 34000 },
    middle_east:   { economy: 25000, business: 50000 },
    japan_korea:   { economy: 34000, business: 68000 },
    se_asia:       { economy: 30000, business: 60000 },
    australia:     { economy: 40000, business: 80000 },
    south_america: { economy: 25000, business: 50000 },
  },
  'aer-lingus': {
    domestic_us:   { economy: 10000, business: 20000 },
    canada_mexico: { economy: 12000, business: 25000 },
    caribbean:     { economy: 12000, business: 25000 },
    europe:        { economy: 10000, premium_economy: 20000, business: 20000 },
    middle_east:   { economy: 25000, business: 50000 },
    japan_korea:   { economy: 35000, business: 70000 },
    se_asia:       { economy: 30000, business: 60000 },
    australia:     { economy: 40000, business: 80000 },
    south_america: { economy: 25000, business: 50000 },
  },
  etihad: {
    domestic_us:   { economy: 15000, business: 30000 },
    canada_mexico: { economy: 17500, business: 35000 },
    caribbean:     { economy: 17500, business: 35000 },
    europe:        { economy: 25000, business: 50000, first: 75000 },
    middle_east:   { economy: 20000, business: 40000, first: 60000 },
    japan_korea:   { economy: 37500, business: 75000, first: 100000 },
    se_asia:       { economy: 30000, business: 60000 },
    australia:     { economy: 40000, business: 80000 },
    south_america: { economy: 35000, business: 70000 },
  },
  jetblue: {
    domestic_us:   { economy: 6500, business: 25000 },
    canada_mexico: { economy: 10000, business: 30000 },
    caribbean:     { economy: 12000, business: 35000 },
    europe:        { economy: 24000, premium_economy: 40000, business: 50000 },
  },
  hawaiian: {
    domestic_us:   { economy: 7500, business: 20000 },
    japan_korea:   { economy: 30000, business: 55000, first: 90000 },
    se_asia:       { economy: 30000, business: 55000 },
    australia:     { economy: 35000, business: 65000 },
  },
  southwest: {
    domestic_us:   { economy: 8000 },
    canada_mexico: { economy: 12000 },
    caribbean:     { economy: 14000 },
  },
}

// Delta uses dynamic pricing, so static chart estimates are intentionally unavailable.
const DYNAMIC_AWARD_PROGRAMS = new Set(['delta'])

// ── Public API ────────────────────────────────────────────────

/**
 * Returns estimated miles for a given program, region, cabin, and passenger count.
 * Returns null if no chart entry exists.
 */
export function getEstimatedMiles(
  slug: string,
  region: RouteRegion,
  cabin: CabinClass,
  passengers: number,
): number | null {
  if (DYNAMIC_AWARD_PROGRAMS.has(slug)) return null
  const programChart = AWARD_CHARTS[slug]
  if (!programChart) return null

  const regionRates = programChart[region] ?? programChart['other']
  if (!regionRates) return null

  // Exact cabin, then fall back to nearest class
  const rate =
    regionRates[cabin] ??
    (cabin === 'premium_economy' ? regionRates['economy'] : null) ??
    (cabin === 'first' ? regionRates['business'] : null) ??
    null

  if (rate == null) return null
  return rate * passengers
}
