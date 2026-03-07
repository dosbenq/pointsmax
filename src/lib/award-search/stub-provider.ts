// ============================================================
// Stub Provider — Static award estimates + deep links
// Uses award charts for mile estimates and Supabase for
// transfer partner data. No external API calls.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AwardProvider,
  AwardSearchParams,
  AwardSearchResult,
  ProgramRow,
  TransferPartnerRow,
  ValuationRow,
} from './types'
import { detectRouteRegion, getEstimatedMiles } from './award-charts'
import { buildDeepLink } from './deep-links'
import {
  buildReachablePaths,
  buildTransferChain,
  calculatePointsNeededFromWallet,
} from './reachable-wallet'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { sortAwardResultsByPoints } from './sort-results'

export class StubProvider implements AwardProvider {
  readonly name = 'stub' as const

  async search(
    params: AwardSearchParams,
    client: SupabaseClient,
  ): Promise<AwardSearchResult[]> {
    const { origin, destination, cabin, passengers, balances } = params
    const programIds = balances.map(b => b.program_id)

    // ── Fetch data in parallel ───────────────────────────────
    const [
      { data: transferPartners },
      { data: allPrograms },
      { data: valuations },
    ] = await Promise.all([
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
    const region = detectRouteRegion(origin, destination)
    const reachablePaths = buildReachablePaths(
      balances,
      programMap,
      (transferPartners as TransferPartnerRow[]) ?? [],
    )

    // ── Build results ────────────────────────────────────────
    const results: AwardSearchResult[] = []

    for (const [slug, path] of reachablePaths) {
      const estimatedMiles = getEstimatedMiles(slug, region, cabin, passengers)
      if (estimatedMiles == null) continue

      const airlineProgram = slugToProgram.get(slug)
      if (!airlineProgram) continue

      // Look up valuation to get cpp_cents and estimated cash value
      const valuation = valuationByProgramId.get(airlineProgram.id)
      const cppCents = resolveCppCents(valuation?.cpp_cents, airlineProgram.type)

      const estimatedCashValueCents = estimatedMiles * cppCents

      // How many source program points are needed to get estimatedMiles
      const pointsNeededFromWallet = calculatePointsNeededFromWallet(path, estimatedMiles)

      const isReachable = path.availableMiles >= estimatedMiles

      results.push({
        program_slug: slug,
        program_name: airlineProgram.name,
        program_color: airlineProgram.color_hex,
        estimated_miles: estimatedMiles,
        estimated_cash_value_cents: estimatedCashValueCents,
        cpp_cents: cppCents,
        transfer_chain: buildTransferChain(path, airlineProgram),
        transfer_is_instant: path.transferIsInstant,
        points_needed_from_wallet: pointsNeededFromWallet,
        availability: null,
        deep_link: buildDeepLink(slug, params),
        has_real_availability: false,
        is_reachable: isReachable,
      })
    }

    return sortAwardResultsByPoints(results)
  }
}
