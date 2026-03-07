// ============================================================
// PointsMax — Calculation Engine
// Takes user balances, returns every redemption option ranked by value.
//
// Think of this like a function that:
//   INPUT:  [{ program_id: "chase-ur-uuid", amount: 80000 }]
//   OUTPUT: ranked list of redemption options with dollar values
// ============================================================

import { createServerDbClient } from '@/lib/supabase'
import type {
  BalanceInput,
  RedemptionResult,
  CalculateResponse,
  Program,
} from '@/types/database'
import { resolveCppCents } from '@/lib/cpp-fallback'

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

type DbError = { message: string; code?: string }

type ReferenceData = {
  valuationMap: Map<string, ValuationRow>
  programMap: Map<string, Program>
  bonusMap: Map<string, number>
  directOptionsByProgram: Map<string, RedemptionOptionRow[]>
  partnersByFromProgram: Map<string, TransferPartnerRow[]>
}

type ReferenceCacheStore = {
  expiresAt: number
  data: ReferenceData | null
  pending: Promise<ReferenceData> | null
}

const REFERENCE_CACHE_TTL_MS = Number.parseInt(
  process.env.CALCULATE_REFERENCE_CACHE_TTL_MS ?? '120000',
  10,
)

function shouldBypassReferenceCache(): boolean {
  if (process.env.NODE_ENV === 'test') return true
  const flag = process.env.DISABLE_CALCULATE_REFERENCE_CACHE
  return flag === '1' || flag === 'true'
}

function getReferenceCacheStore(): ReferenceCacheStore {
  const globalRef = globalThis as typeof globalThis & {
    __pointsmaxCalculateReferenceCache?: ReferenceCacheStore
  }
  if (!globalRef.__pointsmaxCalculateReferenceCache) {
    globalRef.__pointsmaxCalculateReferenceCache = {
      expiresAt: 0,
      data: null,
      pending: null,
    }
  }
  return globalRef.__pointsmaxCalculateReferenceCache
}

async function loadProgramsWithFallback(client: ReturnType<typeof createServerDbClient>): Promise<Program[]> {
  const latest = await client
    .from('programs')
    .select('id, name, short_name, slug, color_hex, type, geography')

  // Backward compatibility: geography column added in migration 006.
  if (latest.error && (latest.error as DbError).code === '42703') {
    const legacy = await client
      .from('programs')
      .select('id, name, short_name, slug, color_hex, type')

    if (legacy.error) {
      throw new Error(`Failed to load programs: ${legacy.error.message}`)
    }

    const rows = (legacy.data as Array<Omit<Program, 'geography'>> ?? [])
      .map((p) => ({ ...p, geography: 'global' }))
    return rows
  }

  if (latest.error) {
    throw new Error(`Failed to load programs: ${latest.error.message}`)
  }

  return (latest.data as Program[] ?? []).map((p) => ({
    ...p,
    geography: p.geography ?? 'global',
  }))
}

async function loadReferenceData(client: ReturnType<typeof createServerDbClient>): Promise<ReferenceData> {
  const [
    valuationsRes,
    transferPartnersRes,
    activeBonusesRes,
    redemptionOptionsRes,
    allPrograms,
  ] = await Promise.all([
    client
      .from('latest_valuations')
      .select('program_id, cpp_cents, program_name, program_slug, program_type'),

    client
      .from('transfer_partners')
      .select('id, from_program_id, to_program_id, ratio_from, ratio_to, transfer_time_max_hrs, is_instant')
      .eq('is_active', true),

    client
      .from('active_bonuses')
      .select('transfer_partner_id, bonus_pct'),

    client
      .from('redemption_options')
      .select('program_id, category, cpp_cents, label'),

    loadProgramsWithFallback(client),
  ])

  if (valuationsRes.error) {
    throw new Error(`Failed to load valuations: ${valuationsRes.error.message}`)
  }
  if (transferPartnersRes.error) {
    throw new Error(`Failed to load transfer partners: ${transferPartnersRes.error.message}`)
  }
  if (activeBonusesRes.error) {
    throw new Error(`Failed to load active bonuses: ${activeBonusesRes.error.message}`)
  }
  if (redemptionOptionsRes.error) {
    throw new Error(`Failed to load redemption options: ${redemptionOptionsRes.error.message}`)
  }

  const valuationMap = new Map<string, ValuationRow>(
    (valuationsRes.data as ValuationRow[] ?? []).map((v) => [v.program_id, v]),
  )
  const programMap = new Map<string, Program>(
    (allPrograms ?? []).map((p) => [p.id, p]),
  )
  const bonusMap = new Map<string, number>(
    (activeBonusesRes.data as ActiveBonusRow[] ?? []).map((b) => [b.transfer_partner_id, b.bonus_pct]),
  )

  const directOptionsByProgram = new Map<string, RedemptionOptionRow[]>()
  for (const row of (redemptionOptionsRes.data as RedemptionOptionRow[] ?? [])) {
    const existing = directOptionsByProgram.get(row.program_id)
    if (existing) {
      existing.push(row)
    } else {
      directOptionsByProgram.set(row.program_id, [row])
    }
  }

  const partnersByFromProgram = new Map<string, TransferPartnerRow[]>()
  for (const row of (transferPartnersRes.data as TransferPartnerRow[] ?? [])) {
    const existing = partnersByFromProgram.get(row.from_program_id)
    if (existing) {
      existing.push(row)
    } else {
      partnersByFromProgram.set(row.from_program_id, [row])
    }
  }

  return {
    valuationMap,
    programMap,
    bonusMap,
    directOptionsByProgram,
    partnersByFromProgram,
  }
}

async function getReferenceData(): Promise<ReferenceData> {
  if (shouldBypassReferenceCache()) {
    return loadReferenceData(createServerDbClient())
  }

  const store = getReferenceCacheStore()
  const now = Date.now()
  const ttl = Number.isFinite(REFERENCE_CACHE_TTL_MS) && REFERENCE_CACHE_TTL_MS > 0
    ? REFERENCE_CACHE_TTL_MS
    : 120000

  if (store.data && store.expiresAt > now) return store.data
  if (store.pending) return store.pending

  store.pending = loadReferenceData(createServerDbClient())
    .then((data) => {
      store.data = data
      store.expiresAt = Date.now() + ttl
      return data
    })
    .finally(() => {
      store.pending = null
    })

  return store.pending
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

export async function calculateRedemptions(
  balances: BalanceInput[]
): Promise<CalculateResponse> {
  const {
    valuationMap,
    programMap,
    bonusMap,
    directOptionsByProgram,
    partnersByFromProgram,
  } = await getReferenceData()

  if (programMap.size === 0) {
    throw new Error('No programs loaded from database')
  }

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
    const directOptions = directOptionsByProgram.get(balance.program_id) ?? []

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
    const partners = partnersByFromProgram.get(balance.program_id) ?? []

    for (const partner of partners) {
      const toValuation = valuationMap.get(partner.to_program_id)
      const toProgram = programMap.get(partner.to_program_id)
      if (!toProgram) continue

      // Apply transfer ratio: e.g. Amex→JetBlue is 250:200
      // so 10,000 Amex MR → 10,000 × (200/250) = 8,000 JetBlue points
      let pointsOut = balance.amount * (partner.ratio_to / partner.ratio_from)

      // Apply active transfer bonus if one exists
      const bonusPct = bonusMap.get(partner.id) ?? 0
      if (bonusPct > 0) {
        pointsOut = pointsOut * (1 + bonusPct / 100)
      }

      const toCppCents = resolveCppCents(toValuation?.cpp_cents, toProgram.type)
      const flooredPointsOut = Math.floor(pointsOut)
      const totalValue = flooredPointsOut * toCppCents
      const effectiveCppCents = balance.amount > 0 ? totalValue / balance.amount : 0

      options.push({
        label: `Transfer to ${toProgram.name}`,
        category: 'transfer_partner',
        from_program: fromProgram,
        to_program: toProgram,
        points_in: balance.amount,
        points_out: flooredPointsOut,
        cpp_cents: effectiveCppCents,
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
      ?? balance.amount * resolveCppCents(valuationMap.get(balance.program_id)?.cpp_cents, fromProgram.type)

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
