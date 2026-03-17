// ============================================================
// Seats.aero Provider — Real award availability
// Requires SEATS_AERO_API_KEY env var.
// Falls back gracefully per-program if API fails.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AwardProvider,
  AwardSearchParams,
  AwardSearchResult,
  CabinClass,
  ProgramRow,
  TransferPartnerRow,
  ValuationRow,
} from './types'
import {
  detectRouteRegion,
  getAwardChartSupportedSlugs,
  getEstimatedMiles,
} from './award-charts'
import { buildDeepLink } from './deep-links'
import {
  buildReachablePaths,
  buildTransferChain,
  calculatePointsNeededFromWallet,
} from './reachable-wallet'
import { estimateAwardCashValue } from './redemption-value'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { logError, logWarn } from '@/lib/logger'
import { sortAwardResultsByPoints } from './sort-results'

// ── Seats.aero Source → our slug ─────────────────────────────
const SEATS_AERO_SOURCE_TO_SLUG: Record<string, string> = {
  // United
  'United': 'united',
  'UnitedMileagePlus': 'united',
  // Delta
  'Delta': 'delta',
  'DeltaSkyMiles': 'delta',
  // American
  'American': 'american',
  'AmericanAAdvantage': 'american',
  // Aeroplan
  'Aeroplan': 'aeroplan',
  'AirCanada': 'aeroplan',
  // British Airways
  'British': 'british-airways',
  'BritishAirways': 'british-airways',
  'Avios': 'british-airways',
  // Flying Blue
  'FlyingBlue': 'flying-blue',
  'AirFrance': 'flying-blue',
  'KLM': 'flying-blue',
  // Singapore
  'Singapore': 'singapore',
  'SingaporeAirlines': 'singapore',
  'KrisFlyer': 'singapore',
  // ANA
  'ANA': 'ana',
  'AllNippon': 'ana',
  // Turkish
  'Turkish': 'turkish',
  'TurkishAirlines': 'turkish',
  // Avianca
  'Avianca': 'avianca',
  'LifeMiles': 'avianca',
  // Emirates
  'Emirates': 'emirates',
  'EmiratesSkywards': 'emirates',
  // Virgin Atlantic
  'VirginAtlantic': 'virgin-atlantic',
  'Virgin': 'virgin-atlantic',
  // Cathay
  'Cathay': 'cathay',
  'CathayPacific': 'cathay',
  'AsiaMiles': 'cathay',
  // Alaska
  'Alaska': 'alaska',
  'AlaskaMileagePlan': 'alaska',
  // JetBlue
  'JetBlue': 'jetblue',
  'TrueBlue': 'jetblue',
  // Iberia
  'Iberia': 'iberia',
  // Aer Lingus
  'AerLingus': 'aer-lingus',
  // Etihad
  'Etihad': 'etihad',
  'EtihadGuest': 'etihad',
  // Hawaiian
  'Hawaiian': 'hawaiian',
  'HawaiianAirlines': 'hawaiian',
}

// ── Cabin class → Seats.aero cabin param ─────────────────────
function toSeatsAeroCabin(cabin: CabinClass): string {
  return {
    economy: 'economy',
    premium_economy: 'premium',
    business: 'business',
    first: 'first',
  }[cabin]
}

// ── Seats.aero availability response shape ───────────────────
interface SeatsAeroFlight {
  ID: string
  RouteID: string
  Route: {
    OriginAirport: string
    DestinationAirport: string
  }
  Date: string
  ParsedDate: string
  YAvailable: boolean
  WAvailable: boolean
  JAvailable: boolean
  FAvailable: boolean
  YMileageCost: string
  WMileageCost: string
  JMileageCost: string
  FMileageCost: string
  YRemainingSeats: number
  WRemainingSeats: number
  JRemainingSeats: number
  FRemainingSeats: number
  Source: string
  ComputedLastSeen: string
  AvailabilityTrips: string[]
}

export class SeatsAeroProvider implements AwardProvider {
  readonly name = 'seats_aero' as const

  constructor(private readonly apiKey: string) {}

  async search(
    params: AwardSearchParams,
    client: SupabaseClient,
  ): Promise<AwardSearchResult[]> {
    const { origin, destination, cabin, passengers, balances, start_date, end_date } = params

    // ── Fetch Supabase data in parallel with Seats.aero API ──
    const [
      seatsAeroResponse,
      { data: transferPartners },
      { data: allPrograms },
      { data: valuations },
    ] = await Promise.all([
      this.fetchSeatsAero(origin, destination, cabin, start_date, end_date),
      client
        .from('transfer_partners')
        .select('id, from_program_id, to_program_id, ratio_from, ratio_to, is_instant, transfer_time_max_hrs')
        .eq('is_active', true),
      client
        .from('programs')
        .select('id, name, short_name, slug, color_hex, type'),
      client
        .from('latest_valuations')
        .select('program_id, cpp_cents, program_name, program_slug, program_type'),
    ])

    // ── Build lookup maps ────────────────────────────────────
    const programMap = new Map<string, ProgramRow>(
      ((allPrograms as ProgramRow[]) ?? []).map(p => [p.id, p]),
    )
    const slugToProgram = new Map<string, ProgramRow>(
      ((allPrograms as ProgramRow[]) ?? []).map(p => [p.slug, p]),
    )
    const valuationByProgramId = new Map<string, ValuationRow>(
      ((valuations as ValuationRow[]) ?? []).map(v => [v.program_id, v]),
    )
    const region = detectRouteRegion(origin, destination)

    // ── Parse availability from Seats.aero ───────────────────
    // Best (lowest mileage) available date per source slug
    interface AvailRecord {
      date: string
      mileageCost: number
    }
    const availBySlug = new Map<string, AvailRecord>()

    const cabinAvailKey = {
      economy: 'YAvailable', premium_economy: 'WAvailable',
      business: 'JAvailable', first: 'FAvailable',
    }[cabin] as keyof SeatsAeroFlight

    const cabinCostKey = {
      economy: 'YMileageCost', premium_economy: 'WMileageCost',
      business: 'JMileageCost', first: 'FMileageCost',
    }[cabin] as keyof SeatsAeroFlight

    for (const flight of (seatsAeroResponse ?? [])) {
      if (!flight[cabinAvailKey]) continue
      const slug = SEATS_AERO_SOURCE_TO_SLUG[flight.Source]
      if (!slug) continue

      const cost = parseInt(String(flight[cabinCostKey] ?? '0'), 10)
      if (isNaN(cost) || cost <= 0) continue

      const existing = availBySlug.get(slug)
      if (!existing || cost < existing.mileageCost) {
        availBySlug.set(slug, { date: flight.Date, mileageCost: cost })
      }
    }

    const reachablePaths = buildReachablePaths(
      balances,
      programMap,
      (transferPartners as TransferPartnerRow[]) ?? [],
    )

    // ── Build results ────────────────────────────────────────
    const results: AwardSearchResult[] = []

    // Include all slugs that either have real availability, a wallet path, or a chart estimate.
    const allSlugs = new Set([
      ...availBySlug.keys(),
      ...reachablePaths.keys(),
      ...getAwardChartSupportedSlugs(region, cabin),
    ])

    for (const slug of allSlugs) {
      const airlineProgram = slugToProgram.get(slug)
      if (!airlineProgram) continue

      const path = reachablePaths.get(slug)
      const avail = availBySlug.get(slug)

      // Use real mileage if available, else fall back to chart estimate
      const estimatedMiles = avail
        ? avail.mileageCost * passengers
        : getEstimatedMiles(slug, region, cabin, passengers)

      if (estimatedMiles == null) continue

      const valuation = valuationByProgramId.get(airlineProgram.id)
      const baselineCppCents = resolveCppCents(valuation?.cpp_cents, airlineProgram.type)
      const modeledRedemptionValue = estimateAwardCashValue({
        routeRegion: region,
        cabin,
        passengers,
        estimatedMiles,
        hasRealAvailability: !!avail,
      })
      const estimatedCashValueCents = modeledRedemptionValue?.cashValueCents ?? (estimatedMiles * baselineCppCents)
      const cppCents = modeledRedemptionValue?.cppCents ?? baselineCppCents

      const pointsNeededFromWallet = path
        ? calculatePointsNeededFromWallet(path, estimatedMiles)
        : estimatedMiles

      const isReachable = path
        ? path.availableMiles >= estimatedMiles
        : false

      results.push({
        program_slug: slug,
        program_name: airlineProgram.name,
        program_color: airlineProgram.color_hex,
        estimated_miles: estimatedMiles,
        estimated_cash_value_cents: estimatedCashValueCents,
        cpp_cents: cppCents,
        baseline_cpp_cents: baselineCppCents,
        cash_value_source: modeledRedemptionValue?.source ?? 'static_program_cpp',
        cash_value_confidence: modeledRedemptionValue?.confidence ?? 'low',
        transfer_chain: path ? buildTransferChain(path) : null,
        transfer_is_instant: path?.transferIsInstant ?? true,
        points_needed_from_wallet: pointsNeededFromWallet,
        availability: avail
          ? { date: avail.date, available: true, source: 'seats_aero' }
          : null,
        deep_link: buildDeepLink(slug, params),
        has_real_availability: !!avail,
        is_reachable: isReachable,
      })
    }

    return sortAwardResultsByPoints(results)
  }

  private async fetchSeatsAero(
    origin: string,
    destination: string,
    cabin: CabinClass,
    startDate: string,
    endDate: string,
  ): Promise<SeatsAeroFlight[]> {
    try {
      const url = new URL('https://seats.aero/partnerapi/search')
      url.searchParams.set('origin_airport', origin)
      url.searchParams.set('destination_airport', destination)
      url.searchParams.set('cabin', toSeatsAeroCabin(cabin))
      url.searchParams.set('start_date', startDate)
      url.searchParams.set('end_date', endDate)

      const res = await fetch(url.toString(), {
        headers: { 'Partner-Authorization': this.apiKey },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 300 }, // cache 5 min
      })

      if (!res.ok) {
        logWarn('seats_aero_api_error', {
          status: res.status,
          body: await res.text(),
        })
        return []
      }

      const json = await res.json()
      // Seats.aero returns { data: [...], count: N } or just an array
      return Array.isArray(json) ? json : (json.data ?? [])
    } catch (err) {
      logError('seats_aero_fetch_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }
}
