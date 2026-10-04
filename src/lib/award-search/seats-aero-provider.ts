// ============================================================
// Seats.aero Provider — Real award availability
// Requires SEATS_AERO_API_KEY env var.
// Falls back gracefully per-program if API fails.
// ============================================================

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
import { estimateAwardCashValueWithLiveFare } from './redemption-value'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { logError, logWarn } from '@/lib/logger'
import { sortAwardResultsByPoints } from './sort-results'
import { fetchCashFareUsd } from './cash-fare-provider'
import { AwardProviderUnavailableError } from './errors'
import { loadAwardCatalog } from './catalog-data'
import { SEATS_AERO_SEARCH_URL } from '@/config/providers'
import { seatsAeroSourceToSlug } from './seats-aero-sources.mjs'

export { seatsAeroSourceToSlug }

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

  async search(params: AwardSearchParams): Promise<AwardSearchResult[]> {
    const { origin, destination, cabin, passengers, balances, start_date, end_date } = params

    // ── Fetch reference data in parallel with Seats.aero ─────
    const [
      seatsAeroResponse,
      { transferPartners, programs: allPrograms, valuations },
    ] = await Promise.all([
      this.fetchSeatsAero(origin, destination, cabin, start_date, end_date),
      loadAwardCatalog(),
    ])

    // ── Build lookup maps ────────────────────────────────────
    const programMap = new Map<string, ProgramRow>(
      allPrograms.map(p => [p.id, p]),
    )
    const slugToProgram = new Map<string, ProgramRow>(
      allPrograms.map(p => [p.slug, p]),
    )
    const valuationByProgramId = new Map<string, ValuationRow>(
      valuations.map(v => [v.program_id, v]),
    )
    const region = detectRouteRegion(origin, destination)
    const liveFareUsd = await fetchCashFareUsd(origin, destination, cabin, start_date)

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
      const slug = seatsAeroSourceToSlug(flight.Source)
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
      transferPartners,
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
      const modeledRedemptionValue = estimateAwardCashValueWithLiveFare({
        routeRegion: region,
        cabin,
        passengers,
        estimatedMiles,
        hasRealAvailability: !!avail,
        liveFareUsd,
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
    const url = new URL(SEATS_AERO_SEARCH_URL)
    url.searchParams.set('origin_airport', origin)
    url.searchParams.set('destination_airport', destination)
    url.searchParams.set('cabin', toSeatsAeroCabin(cabin))
    url.searchParams.set('start_date', startDate)
    url.searchParams.set('end_date', endDate)

    let res: Response
    try {
      res = await fetch(url.toString(), {
        headers: { 'Partner-Authorization': this.apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 300 }, // cache 5 min
      })
    } catch (err) {
      logError('seats_aero_fetch_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      throw new AwardProviderUnavailableError('Live award availability is temporarily unreachable.')
    }

    // Auth, quota and server failures must not masquerade as "no seats":
    // surface them so the caller falls back to clearly-labelled estimates.
    if (res.status === 401 || res.status === 403) {
      logError('seats_aero_auth_failure', { status: res.status })
      throw new AwardProviderUnavailableError(`Award search provider rejected the API key (${res.status}).`)
    }
    if (res.status === 429) {
      logError('seats_aero_rate_limited', { status: res.status })
      throw new AwardProviderUnavailableError('Award search provider daily quota exhausted (429).')
    }
    if (res.status >= 500) {
      logError('seats_aero_server_error', { status: res.status })
      throw new AwardProviderUnavailableError(`Award search provider unavailable (${res.status}).`)
    }
    if (!res.ok) {
      // 404 / other 4xx for a valid request means "no results for this route".
      logWarn('seats_aero_client_error', { status: res.status })
      return []
    }

    try {
      const json: unknown = await res.json()
      // Seats.aero returns { data: [...], count: N } (older responses: a bare array).
      if (Array.isArray(json)) return json as SeatsAeroFlight[]
      const data = (json as { data?: unknown } | null)?.data
      return Array.isArray(data) ? (data as SeatsAeroFlight[]) : []
    } catch (err) {
      logError('seats_aero_parse_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      throw new AwardProviderUnavailableError('Award search provider returned an unreadable response.')
    }
  }
}
