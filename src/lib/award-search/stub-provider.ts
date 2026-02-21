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
import { resolveCppCents } from '@/lib/cpp-fallback'

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
    const balanceMap = new Map<string, number>(
      balances.map(b => [b.program_id, b.amount]),
    )

    const region = detectRouteRegion(origin, destination)

    // ── Track best reachable path per destination airline slug ──
    // key: airline slug
    // value: best available miles + metadata about the source
    interface ReachablePath {
      availableMiles: number          // miles available after transfer
      sourceProgram: ProgramRow
      balance: number
      ratioFrom: number
      ratioTo: number
      isInstant: boolean
      transferTimeMaxHrs: number
      directHold: boolean             // user holds airline miles directly
    }

    const bestPathBySlug = new Map<string, ReachablePath>()

    // 1. Direct airline miles held by the user
    for (const balance of balances) {
      const prog = programMap.get(balance.program_id)
      if (!prog || prog.type !== 'airline_miles') continue
      const existing = bestPathBySlug.get(prog.slug)
      if (!existing || balance.amount > existing.availableMiles) {
        bestPathBySlug.set(prog.slug, {
          availableMiles: balance.amount,
          sourceProgram: prog,
          balance: balance.amount,
          ratioFrom: 1,
          ratioTo: 1,
          isInstant: true,
          transferTimeMaxHrs: 0,
          directHold: true,
        })
      }
    }

    // 2. Transferable points → airline miles
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

    for (const [slug, path] of bestPathBySlug) {
      const estimatedMiles = getEstimatedMiles(slug, region, cabin, passengers)
      if (estimatedMiles == null) continue

      const airlineProgram = slugToProgram.get(slug)
      if (!airlineProgram) continue

      // Look up valuation to get cpp_cents and estimated cash value
      const valuation = valuationByProgramId.get(airlineProgram.id)
      const cppCents = resolveCppCents(valuation?.cpp_cents, airlineProgram.type)

      const estimatedCashValueCents = estimatedMiles * cppCents

      // How many source program points are needed to get estimatedMiles
      const pointsNeededFromWallet = path.directHold
        ? estimatedMiles
        : Math.ceil(estimatedMiles * (path.ratioFrom / path.ratioTo))

      const isReachable = path.availableMiles >= estimatedMiles

      // Transfer chain string
      let transferChain: string | null = null
      if (!path.directHold) {
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
        transfer_is_instant: path.isInstant,
        points_needed_from_wallet: pointsNeededFromWallet,
        availability: null,
        deep_link: buildDeepLink(slug, params),
        has_real_availability: false,
        is_reachable: isReachable,
      })
    }

    // ── Sort: reachable first, then by estimated cash value desc ─
    results.sort((a, b) => {
      if (a.is_reachable !== b.is_reachable) {
        return a.is_reachable ? -1 : 1
      }
      return b.estimated_cash_value_cents - a.estimated_cash_value_cents
    })

    return results
  }
}
