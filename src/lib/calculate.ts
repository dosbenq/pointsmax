// ============================================================
// PointsMax — Calculation Engine
// Takes user balances, returns every redemption option ranked by value.
//
// Think of this like a function that:
//   INPUT:  [{ program_id: "chase-ur-uuid", amount: 80000 }]
//   OUTPUT: ranked list of redemption options with dollar values
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type {
  BalanceInput,
  RedemptionResult,
  CalculateResponse,
  Program,
} from '@/types/database'

// ─────────────────────────────────────────────
// TYPES for raw DB rows we fetch
// ─────────────────────────────────────────────

interface ValuationRow {
  program_id: string
  cpp_cents: number
  program_name: string
  program_slug: string
  program_type: string
}

interface TransferPartnerRow {
  id: string
  from_program_id: string
  to_program_id: string
  ratio_from: number
  ratio_to: number
  transfer_time_max_hrs: number
  is_instant: boolean
}

interface ActiveBonusRow {
  transfer_partner_id: string
  bonus_pct: number
}

interface RedemptionOptionRow {
  program_id: string
  category: string
  cpp_cents: number
  label: string
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

export async function calculateRedemptions(
  balances: BalanceInput[]
): Promise<CalculateResponse> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!   // server-side: use service role to bypass RLS
  )

  const programIds = balances.map(b => b.program_id)

  // ── Fetch everything we need in parallel (like async tasks in C++) ──
  const [
    { data: valuations },
    { data: transferPartners },
    { data: activeBonuses },
    { data: redemptionOptions },
    { data: allPrograms },
  ] = await Promise.all([
    client
      .from('latest_valuations')
      .select('program_id, cpp_cents, program_name, program_slug, program_type'),

    client
      .from('transfer_partners')
      .select('id, from_program_id, to_program_id, ratio_from, ratio_to, transfer_time_max_hrs, is_instant')
      .in('from_program_id', programIds)
      .eq('is_active', true),

    client
      .from('active_bonuses')
      .select('transfer_partner_id, bonus_pct'),

    client
      .from('redemption_options')
      .select('program_id, category, cpp_cents, label')
      .in('program_id', programIds),

    client
      .from('programs')
      .select('id, name, short_name, slug, color_hex, type'),
  ])

  // ── Build lookup maps (like hash maps / unordered_map in C++) ──
  const valuationMap = new Map<string, ValuationRow>(
    (valuations as ValuationRow[] ?? []).map(v => [v.program_id, v])
  )
  const programMap = new Map<string, Program>(
    (allPrograms as Program[] ?? []).map(p => [p.id, p])
  )
  // Map: transfer_partner_id → bonus_pct
  const bonusMap = new Map<string, number>(
    (activeBonuses as ActiveBonusRow[] ?? []).map(b => [b.transfer_partner_id, b.bonus_pct])
  )

  const results: RedemptionResult[] = []
  let totalCashValue = 0
  let totalOptimalValue = 0

  // ── Process each balance the user entered ──
  for (const balance of balances) {
    const fromProgram = programMap.get(balance.program_id)
    if (!fromProgram) continue

    const options: RedemptionResult[] = []

    // 1. Direct redemption options (travel portal, cash back, gift cards, etc.)
    //    These come from the redemption_options table seeded in the DB.
    const directOptions = (redemptionOptions as RedemptionOptionRow[] ?? [])
      .filter(r => r.program_id === balance.program_id)

    for (const opt of directOptions) {
      options.push({
        label: opt.label,
        category: opt.category as RedemptionResult['category'],
        from_program: fromProgram,
        points_in: balance.amount,
        points_out: balance.amount,
        cpp_cents: opt.cpp_cents,
        total_value_cents: balance.amount * opt.cpp_cents,
        is_instant: true,
        is_best: false,
      })
    }

    // 2. Transfer partner options
    //    For each partner: apply transfer ratio, apply active bonus if any,
    //    then multiply by the destination program's CPP.
    const partners = (transferPartners as TransferPartnerRow[] ?? [])
      .filter(tp => tp.from_program_id === balance.program_id)

    for (const partner of partners) {
      const toValuation = valuationMap.get(partner.to_program_id)
      const toProgram = programMap.get(partner.to_program_id)
      if (!toValuation || !toProgram) continue

      // Apply transfer ratio: e.g. Amex→JetBlue is 250:200
      // so 10,000 Amex MR → 10,000 × (200/250) = 8,000 JetBlue points
      let pointsOut = balance.amount * (partner.ratio_to / partner.ratio_from)

      // Apply active transfer bonus if one exists
      const bonusPct = bonusMap.get(partner.id) ?? 0
      if (bonusPct > 0) {
        pointsOut = pointsOut * (1 + bonusPct / 100)
      }

      const totalValue = Math.floor(pointsOut) * toValuation.cpp_cents

      options.push({
        label: `Transfer to ${toProgram.name}`,
        category: 'transfer_partner',
        from_program: fromProgram,
        to_program: toProgram,
        points_in: balance.amount,
        points_out: Math.floor(pointsOut),
        cpp_cents: toValuation.cpp_cents,
        total_value_cents: totalValue,
        active_bonus_pct: bonusPct > 0 ? bonusPct : undefined,
        is_instant: partner.is_instant,
        transfer_time_max_hrs: partner.transfer_time_max_hrs,
        is_best: false,
      })
    }

    // Sort this program's options by total value, highest first
    options.sort((a, b) => b.total_value_cents - a.total_value_cents)

    // Mark the single best option for this program
    if (options.length > 0) options[0].is_best = true

    // Cash floor: the lowest direct redemption (cash back / statement credit)
    // This is the baseline — what most people get without thinking
    const cashOption = options.find(
      o => o.category === 'cashback' || o.category === 'statement_credit'
    )
    const cashValue = cashOption?.total_value_cents
      ?? balance.amount * (valuationMap.get(balance.program_id)?.cpp_cents ?? 1)

    totalCashValue += cashValue
    totalOptimalValue += options[0]?.total_value_cents ?? cashValue

    results.push(...options)
  }

  // Final global sort: best options across all programs at the top
  results.sort((a, b) => b.total_value_cents - a.total_value_cents)

  return {
    total_cash_value_cents: totalCashValue,
    total_optimal_value_cents: totalOptimalValue,
    value_left_on_table_cents: totalOptimalValue - totalCashValue,
    results,
  }
}
