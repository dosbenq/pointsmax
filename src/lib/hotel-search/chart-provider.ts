import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildReachablePaths,
  buildTransferChain,
  calculatePointsNeededFromWallet,
} from '@/lib/award-search/reachable-wallet'
import type { ProgramRow, TransferPartnerRow } from '@/lib/award-search/types'
import { getHotelBookingUrl } from './deep-links'
import type {
  HotelAwardChartRow,
  HotelProgramRow,
  HotelSearchParams,
  HotelSearchResult,
} from './types'

function calculateNights(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`)
  const end = Date.parse(`${checkOut}T00:00:00Z`)
  const diffMs = end - start
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
}

function normalizeHotelHint(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function matchesHotelHint(chain: string, programName: string, hotelHint: string): boolean {
  if (!hotelHint) return true

  const candidates = [chain, programName]
    .map((value) => value.toLowerCase())

  if (candidates.some((value) => value.includes(hotelHint) || hotelHint.includes(value))) {
    return true
  }

  const keywordMap: Array<{ keywords: string[]; matches: string[] }> = [
    { keywords: ['hyatt', 'park hyatt', 'grand hyatt', 'andaz', 'alila', 'caption by hyatt'], matches: ['hyatt', 'world of hyatt'] },
    { keywords: ['marriott', 'jw marriott', 'st. regis', 'ritz-carlton', 'w hotel', 'edition', 'sheraton', 'westin', 'le meridien'], matches: ['marriott', 'bonvoy'] },
    { keywords: ['hilton', 'waldorf', 'conrad', 'curio', 'canopy', 'doubletree', 'hampton'], matches: ['hilton', 'honors'] },
  ]

  const inferredMatches = keywordMap.find((entry) => entry.keywords.some((keyword) => hotelHint.includes(keyword)))
  if (!inferredMatches) return false

  return inferredMatches.matches.some((match) =>
    candidates.some((value) => value.includes(match)),
  )
}

const QUERY_TIMEOUT_MS = 10_000 // 10 seconds

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timeout])
}

export class ChartHotelProvider {
  async search(params: HotelSearchParams, client: SupabaseClient): Promise<HotelSearchResult[]> {
    const nights = calculateNights(params.check_in, params.check_out)
    const hotelHint = normalizeHotelHint(params.hotel_name)

    const [{ data: hotelPrograms, error: hotelProgramError }, { data: charts, error: chartError }] = await withTimeout(Promise.all([
      client
        .from('hotel_programs')
        .select('id, slug, name, chain, booking_url, color_hex')
        .eq('is_active', true),
      client
        .from('hotel_award_charts')
        .select('program_id, destination_region, tier_label, tier_number, points_off_peak, points_standard, points_peak, estimated_cash_usd')
        .eq('destination_region', params.destination_region),
    ]), QUERY_TIMEOUT_MS, 'Hotel search database queries')

    if (hotelProgramError) {
      throw new Error(`Failed to load hotel programs: ${hotelProgramError.message}`)
    }
    if (chartError) {
      throw new Error(`Failed to load hotel award charts: ${chartError.message}`)
    }

    const hotelProgramRows = (hotelPrograms as HotelProgramRow[] | null) ?? []
    const chartRows = (charts as HotelAwardChartRow[] | null) ?? []
    const hotelSlugs = hotelProgramRows.map((row) => row.slug)

    const [{ data: programs, error: programError }, { data: transferPartners, error: transferError }] = await Promise.all([
      client
        .from('programs')
        .select('id, name, short_name, slug, color_hex, type')
        .eq('is_active', true),
      client
        .from('transfer_partners')
        .select('id, from_program_id, to_program_id, ratio_from, ratio_to, is_instant, transfer_time_max_hrs')
        .eq('is_active', true),
    ])

    if (programError) {
      throw new Error(`Failed to load programs: ${programError.message}`)
    }
    if (transferError) {
      throw new Error(`Failed to load transfer partners: ${transferError.message}`)
    }

    const programRows = ((programs as ProgramRow[] | null) ?? [])
    const walletProgramIds = new Set(params.balances.map((balance) => balance.program_id))
    const enrichedProgramRows = programRows.filter((row) => hotelSlugs.includes(row.slug) || walletProgramIds.has(row.id))
    const programMap = new Map(enrichedProgramRows.map((row) => [row.id, row]))
    const reachablePaths = buildReachablePaths(
      params.balances.filter((balance) => balance.amount > 0),
      programMap,
      ((transferPartners as TransferPartnerRow[] | null) ?? []).filter((row) =>
        programMap.has(row.from_program_id) && programMap.has(row.to_program_id),
      ),
    )

    const hotelProgramById = new Map(hotelProgramRows.map((row) => [row.id, row]))
    const results: HotelSearchResult[] = chartRows.flatMap((chart) => {
      const hotelProgram = hotelProgramById.get(chart.program_id)
      if (!hotelProgram) return []
      if (!matchesHotelHint(hotelProgram.chain, hotelProgram.name, hotelHint)) return []

      const path = reachablePaths.get(hotelProgram.slug)
      const pointsStandardTotal = chart.points_standard * nights
      const estimatedCashValueUsd = chart.estimated_cash_usd * nights
      const pointsNeededFromWallet = path
        ? calculatePointsNeededFromWallet(path, pointsStandardTotal)
        : pointsStandardTotal

      return [{
        program_slug: hotelProgram.slug,
        program_name: hotelProgram.name,
        chain: hotelProgram.chain,
        tier_label: chart.tier_label,
        tier_number: chart.tier_number,
        nights,
        points_off_peak_total: chart.points_off_peak ? chart.points_off_peak * nights : null,
        points_standard_total: pointsStandardTotal,
        points_peak_total: chart.points_peak ? chart.points_peak * nights : null,
        estimated_cash_value_usd: estimatedCashValueUsd,
        cpp_cents: Number(((estimatedCashValueUsd * 100) / Math.max(pointsStandardTotal, 1)).toFixed(2)),
        transfer_chain: path ? buildTransferChain(path) : null,
        transfer_is_instant: path?.transferIsInstant ?? false,
        transfer_time_max_hrs: path?.transferTimeMaxHrs ?? 0,
        is_reachable: Boolean(path && path.availableMiles >= pointsStandardTotal),
        points_needed_from_wallet: pointsNeededFromWallet,
        booking_url: getHotelBookingUrl(hotelProgram.slug, hotelProgram.booking_url),
      }]
    })

    return results.sort((left, right) => {
      if (left.is_reachable !== right.is_reachable) return left.is_reachable ? -1 : 1
      if (left.cpp_cents !== right.cpp_cents) return right.cpp_cents - left.cpp_cents
      return left.points_standard_total - right.points_standard_total
    })
  }
}
