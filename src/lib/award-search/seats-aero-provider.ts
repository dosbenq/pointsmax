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
import { detectRouteRegion, getEstimatedMiles } from './award-charts'
import { buildDeepLink } from './deep-links'

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
    const programIds = balances.map(b => b.program_id)

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
        .in('from_program_id', programIds)
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
    const balanceMap = new Map<string, number>(
      balances.map(b => [b.program_id, b.amount]),
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

    // ── Build best reachable path per airline slug ────────────
    interface ReachablePath {
      availableMiles: number
      sourceProgram: ProgramRow
      balance: number
      ratioFrom: number
      ratioTo: number
      isInstant: boolean
      transferTimeMaxHrs: number
      directHold: boolean
    }

    const bestPathBySlug = new Map<string, ReachablePath>()

    // Direct airline miles
    for (const balance of balances) {
      const prog = programMap.get(balance.program_id)
      if (!prog || prog.type !== 'airline_miles') continue
      const existing = bestPathBySlug.get(prog.slug)
      if (!existing || balance.amount > existing.availableMiles) {
        bestPathBySlug.set(prog.slug, {
          availableMiles: balance.amount,
          sourceProgram: prog,
          balance: balance.amount,
          ratioFrom: 1, ratioTo: 1,
          isInstant: true,
          transferTimeMaxHrs: 0,
          directHold: true,
        })
      }
    }

    // Transfer partner paths
    for (const tp of ((transferPartners as TransferPartnerRow[]) ?? [])) {
      const toProgram = programMap.get(tp.to_program_id)
      if (!toProgram || toProgram.type !== 'airline_miles') continue

      const balance = balanceMap.get(tp.from_program_id) ?? 0
      const milesAfterTransfer = Math.floor(balance * (tp.ratio_to / tp.ratio_from))

      const existing = bestPathBySlug.get(toProgram.slug)
      if (!existing || milesAfterTransfer > existing.availableMiles) {
        const sourceProgram = programMap.get(tp.from_program_id)!
        bestPathBySlug.set(toProgram.slug, {
          availableMiles: milesAfterTransfer,
          sourceProgram,
          balance,
          ratioFrom: tp.ratio_from,
          ratioTo: tp.ratio_to,
          isInstant: tp.is_instant,
          transferTimeMaxHrs: tp.transfer_time_max_hrs,
          directHold: false,
        })
      }
    }

    // ── Build results ────────────────────────────────────────
    const results: AwardSearchResult[] = []

    // Include all slugs that either have real availability or have a path
    const allSlugs = new Set([...availBySlug.keys(), ...bestPathBySlug.keys()])

    for (const slug of allSlugs) {
      const airlineProgram = slugToProgram.get(slug)
      if (!airlineProgram) continue

      const path = bestPathBySlug.get(slug)
      const avail = availBySlug.get(slug)

      // Use real mileage if available, else fall back to chart estimate
      const estimatedMiles = avail
        ? avail.mileageCost * passengers
        : getEstimatedMiles(slug, region, cabin, passengers)

      if (estimatedMiles == null) continue

      const valuation = valuationByProgramId.get(airlineProgram.id)
      const cppCents = valuation?.cpp_cents ?? 100
      const estimatedCashValueCents = estimatedMiles * cppCents

      const pointsNeededFromWallet = path
        ? (path.directHold
            ? estimatedMiles
            : Math.ceil(estimatedMiles * (path.ratioFrom / path.ratioTo)))
        : estimatedMiles

      const isReachable = path
        ? path.availableMiles >= estimatedMiles
        : false

      let transferChain: string | null = null
      if (path && !path.directHold) {
        const ratio =
          path.ratioFrom === path.ratioTo
            ? '1:1'
            : `${path.ratioFrom}:${path.ratioTo}`
        transferChain = `${path.sourceProgram.name} → ${airlineProgram.name} (${ratio})`
      }

      results.push({
        program_slug: slug,
        program_name: airlineProgram.name,
        program_color: airlineProgram.color_hex,
        estimated_miles: estimatedMiles,
        estimated_cash_value_cents: estimatedCashValueCents,
        cpp_cents: cppCents,
        transfer_chain: transferChain,
        transfer_is_instant: path?.isInstant ?? true,
        points_needed_from_wallet: pointsNeededFromWallet,
        availability: avail
          ? { date: avail.date, available: true, source: 'seats_aero' }
          : null,
        deep_link: buildDeepLink(slug, params),
        has_real_availability: !!avail,
        is_reachable: isReachable,
      })
    }

    results.sort((a, b) => {
      if (a.is_reachable !== b.is_reachable) return a.is_reachable ? -1 : 1
      if (a.has_real_availability !== b.has_real_availability) return a.has_real_availability ? -1 : 1
      return b.estimated_cash_value_cents - a.estimated_cash_value_cents
    })

    return results
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
        next: { revalidate: 300 }, // cache 5 min
      })

      if (!res.ok) {
        console.error('[SeatsAero] API error:', res.status, await res.text())
        return []
      }

      const json = await res.json()
      // Seats.aero returns { data: [...], count: N } or just an array
      return Array.isArray(json) ? json : (json.data ?? [])
    } catch (err) {
      console.error('[SeatsAero] Fetch failed:', err)
      return []
    }
  }
}
