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
import { getCatalogLatestValuations, getCatalogPrograms, getCatalogRedemptionOptions, getCatalogTransferPartners } from '@/lib/catalog'
import { logWarn } from '@/lib/logger'

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

type TransferExplorationState = {
  currentProgramId: string
  pointsOut: number
  isInstant: boolean
  transferTimeMaxHrs: number
  hopCount: number
  pathProgramIds: string[]
  appliedBonuses: number[]
}

type TransferOptionCandidate = {
  targetProgram: Program
  pointsOut: number
  effectiveCppCents: number
  totalValueCents: number
  isInstant: boolean
  transferTimeMaxHrs: number
  hopCount: number
  pathProgramIds: string[]
  appliedBonuses: number[]
}

const MAX_TRANSFER_HOPS = 3

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

/**
 * Active, verified transfer bonuses (time-bound data that stays in the
 * database). The calculator still works without them, so a database outage
 * just means no bonus boost.
 */
async function loadActiveBonuses(): Promise<ActiveBonusRow[]> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await createServerDbClient()
      .from('transfer_bonuses')
      .select('transfer_partner_id, bonus_pct')
      .eq('is_verified', true)
      .lte('start_date', today)
      .gte('end_date', today)
    if (error) throw new Error(error.message)
    return (data as ActiveBonusRow[] | null) ?? []
  } catch (error) {
    logWarn('calculate_active_bonuses_unavailable', {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

async function loadReferenceData(): Promise<ReferenceData> {
  const activeBonuses = await loadActiveBonuses()

  const valuationMap = new Map<string, ValuationRow>(
    getCatalogLatestValuations().map((v) => [v.program_id, v as ValuationRow]),
  )
  const programMap = new Map<string, Program>(
    getCatalogPrograms({ includeInactive: true }).map((p) => [p.id, { ...p, geography: p.geography ?? 'global' }]),
  )
  const bonusMap = new Map<string, number>(
    activeBonuses.map((b) => [b.transfer_partner_id, b.bonus_pct]),
  )

  const directOptionsByProgram = new Map<string, RedemptionOptionRow[]>()
  for (const row of getCatalogRedemptionOptions() as RedemptionOptionRow[]) {
    const existing = directOptionsByProgram.get(row.program_id)
    if (existing) {
      existing.push(row)
    } else {
      directOptionsByProgram.set(row.program_id, [row])
    }
  }

  const partnersByFromProgram = new Map<string, TransferPartnerRow[]>()
  for (const row of getCatalogTransferPartners() as TransferPartnerRow[]) {
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
    return loadReferenceData()
  }

  const store = getReferenceCacheStore()
  const now = Date.now()
  const ttl = Number.isFinite(REFERENCE_CACHE_TTL_MS) && REFERENCE_CACHE_TTL_MS > 0
    ? REFERENCE_CACHE_TTL_MS
    : 120000

  if (store.data && store.expiresAt > now) return store.data
  if (store.pending) return store.pending

  store.pending = loadReferenceData()
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

function chooseBetterTransferCandidate(
  current: TransferOptionCandidate | undefined,
  candidate: TransferOptionCandidate,
): TransferOptionCandidate {
  if (!current) return candidate
  if (candidate.totalValueCents !== current.totalValueCents) {
    return candidate.totalValueCents > current.totalValueCents ? candidate : current
  }
  if (candidate.pointsOut !== current.pointsOut) {
    return candidate.pointsOut > current.pointsOut ? candidate : current
  }
  if (candidate.isInstant !== current.isInstant) {
    return candidate.isInstant ? candidate : current
  }
  if (candidate.transferTimeMaxHrs !== current.transferTimeMaxHrs) {
    return candidate.transferTimeMaxHrs < current.transferTimeMaxHrs ? candidate : current
  }
  if (candidate.hopCount !== current.hopCount) {
    return candidate.hopCount < current.hopCount ? candidate : current
  }
  return current
}

function buildTransferOptionLabel(targetProgram: Program, pathProgramIds: string[], programMap: Map<string, Program>): string {
  if (pathProgramIds.length <= 2) return `Transfer to ${targetProgram.name}`
  const intermediates = pathProgramIds
    .slice(1, -1)
    .map((programId) => programMap.get(programId)?.name)
    .filter((name): name is string => Boolean(name))

  return intermediates.length > 0
    ? `Transfer to ${targetProgram.name} via ${intermediates.join(' → ')}`
    : `Transfer to ${targetProgram.name}`
}

function buildTransferOptionsForBalance(
  balance: BalanceInput,
  fromProgram: Program,
  referenceData: ReferenceData,
): RedemptionResult[] {
  const {
    valuationMap,
    programMap,
    bonusMap,
    partnersByFromProgram,
  } = referenceData

  const bestByTargetProgramId = new Map<string, TransferOptionCandidate>()
  const queue: TransferExplorationState[] = [{
    currentProgramId: balance.program_id,
    pointsOut: balance.amount,
    isInstant: true,
    transferTimeMaxHrs: 0,
    hopCount: 0,
    pathProgramIds: [balance.program_id],
    appliedBonuses: [],
  }]

  while (queue.length > 0) {
    const state = queue.shift()
    if (!state || state.hopCount >= MAX_TRANSFER_HOPS) continue

    const partners = partnersByFromProgram.get(state.currentProgramId) ?? []
    for (const partner of partners) {
      if (state.pathProgramIds.includes(partner.to_program_id)) continue

      const toProgram = programMap.get(partner.to_program_id)
      if (!toProgram) continue

      let pointsOut = state.pointsOut * (partner.ratio_to / partner.ratio_from)
      const bonusPct = bonusMap.get(partner.id) ?? 0
      if (bonusPct > 0) {
        pointsOut = pointsOut * (1 + bonusPct / 100)
      }

      const flooredPointsOut = Math.floor(pointsOut)
      if (flooredPointsOut <= 0) continue

      const toValuation = valuationMap.get(partner.to_program_id)
      const toCppCents = resolveCppCents(toValuation?.cpp_cents, toProgram.type, toProgram.slug)
      const totalValueCents = flooredPointsOut * toCppCents
      const effectiveCppCents = balance.amount > 0 ? totalValueCents / balance.amount : 0

      const candidate: TransferOptionCandidate = {
        targetProgram: toProgram,
        pointsOut: flooredPointsOut,
        effectiveCppCents,
        totalValueCents,
        isInstant: state.isInstant && partner.is_instant,
        transferTimeMaxHrs: Math.max(state.transferTimeMaxHrs, partner.transfer_time_max_hrs),
        hopCount: state.hopCount + 1,
        pathProgramIds: [...state.pathProgramIds, toProgram.id],
        appliedBonuses: bonusPct > 0 ? [...state.appliedBonuses, bonusPct] : [...state.appliedBonuses],
      }

      const existing = bestByTargetProgramId.get(toProgram.id)
      bestByTargetProgramId.set(
        toProgram.id,
        chooseBetterTransferCandidate(existing, candidate),
      )

      queue.push({
        currentProgramId: toProgram.id,
        pointsOut: flooredPointsOut,
        isInstant: candidate.isInstant,
        transferTimeMaxHrs: candidate.transferTimeMaxHrs,
        hopCount: candidate.hopCount,
        pathProgramIds: candidate.pathProgramIds,
        appliedBonuses: candidate.appliedBonuses,
      })
    }
  }

  return [...bestByTargetProgramId.values()].map((candidate) => ({
    label: buildTransferOptionLabel(candidate.targetProgram, candidate.pathProgramIds, programMap),
    category: 'transfer_partner',
    from_program: fromProgram,
    to_program: candidate.targetProgram,
    points_in: balance.amount,
    points_out: candidate.pointsOut,
    cpp_cents: candidate.effectiveCppCents,
    total_value_cents: candidate.totalValueCents,
    active_bonus_pct: candidate.hopCount === 1 && candidate.appliedBonuses.length === 1
      ? candidate.appliedBonuses[0]
      : undefined,
    is_instant: candidate.isInstant,
    transfer_time_max_hrs: candidate.transferTimeMaxHrs,
    is_best: false,
  }))
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

export async function calculateRedemptions(
  balances: BalanceInput[]
): Promise<CalculateResponse> {
  const referenceData = await getReferenceData()
  const {
    programMap,
    directOptionsByProgram,
  } = referenceData

  if (programMap.size === 0) {
    throw new Error('No programs loaded from database')
  }

  const results: RedemptionResult[] = []
  let totalOptimalValue = 0
  let totalCashValue = 0
  let cashBaselineAvailable = true

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
    //    Explore up to three transfer hops, carrying ratios/bonuses forward
    //    and keeping the highest-value path to each destination program.
    options.push(...buildTransferOptionsForBalance(balance, fromProgram, referenceData))

    // Sort this program's options by total value, highest first
    options.sort((a, b) => b.total_value_cents - a.total_value_cents || a.label.localeCompare(b.label))

    // Mark the single best option for this program
    if (options.length > 0) options[0].is_best = true

    const cashOption = options.find(
      (o) => o.category === 'cashback' || o.category === 'statement_credit',
    )
    if (cashOption) {
      totalCashValue += cashOption.total_value_cents
    } else {
      cashBaselineAvailable = false
    }

    totalOptimalValue += options[0]?.total_value_cents ?? 0

    results.push(...options)
  }

  // Final global sort: best options across all programs at the top
  results.sort((a, b) => b.total_value_cents - a.total_value_cents || a.label.localeCompare(b.label))

  const hasDbValuations = referenceData.valuationMap.size > 0
  const valuationSource = hasDbValuations
    ? 'TPG April 2026 · DB-backed · Updated daily'
    : 'TPG April 2026 · Fallback estimates'

  return {
    total_cash_value_cents: cashBaselineAvailable ? totalCashValue : null,
    total_optimal_value_cents: totalOptimalValue,
    value_left_on_table_cents: cashBaselineAvailable ? totalOptimalValue - totalCashValue : null,
    cash_baseline_available: cashBaselineAvailable,
    results,
    valuation_source: valuationSource,
  }
}
