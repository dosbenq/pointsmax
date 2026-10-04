// ============================================================
// PointsMax — Calculation Engine
// Takes user balances, returns every redemption option ranked by value.
//
// Think of this like a function that:
//   INPUT:  [{ program_id: "chase-ur-uuid", amount: 80000 }]
//   OUTPUT: ranked list of redemption options with dollar values
// ============================================================

import { eq } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db/client'
import { activeBonuses, latestValuations, programs, redemptionOptions, transferPartners } from '@/lib/db/schema'
import type {
  BalanceInput,
  RedemptionResult,
  CalculateResponse,
  Program,
} from '@/types/database'
import { resolveCppCents } from '@/lib/cpp-fallback'
import { convertPointValue, describeValuationReview } from '@/lib/catalog'

// ─────────────────────────────────────────────
// TYPES for raw DB rows we fetch
// ─────────────────────────────────────────────

interface ValuationRow {
  program_id: string
  cpp_cents: number
  effective_date: string | null
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

async function loadReferenceData(db: Database): Promise<ReferenceData> {
  const [
    valuationRows,
    transferPartnerRows,
    activeBonusRows,
    redemptionOptionRows,
    allPrograms,
  ] = await Promise.all([
    db.select({
      program_id: latestValuations.programId,
      cpp_cents: latestValuations.cppCents,
      effective_date: latestValuations.effectiveDate,
      program_name: latestValuations.programName,
      program_slug: latestValuations.programSlug,
      program_type: latestValuations.programType,
    }).from(latestValuations),

    db.select({
      id: transferPartners.id,
      from_program_id: transferPartners.fromProgramId,
      to_program_id: transferPartners.toProgramId,
      ratio_from: transferPartners.ratioFrom,
      ratio_to: transferPartners.ratioTo,
      transfer_time_max_hrs: transferPartners.transferTimeMaxHrs,
      is_instant: transferPartners.isInstant,
    }).from(transferPartners).where(eq(transferPartners.isActive, true)),

    db.select({
      transfer_partner_id: activeBonuses.transferPartnerId,
      bonus_pct: activeBonuses.bonusPct,
    }).from(activeBonuses),

    db.select({
      program_id: redemptionOptions.programId,
      category: redemptionOptions.category,
      cpp_cents: redemptionOptions.cppCents,
      label: redemptionOptions.label,
    }).from(redemptionOptions),

    db.select({
      id: programs.id,
      name: programs.name,
      short_name: programs.shortName,
      slug: programs.slug,
      color_hex: programs.colorHex,
      type: programs.type,
      geography: programs.geography,
    }).from(programs),
  ])

  const valuationMap = new Map<string, ValuationRow>(
    valuationRows
      .filter((v): v is typeof v & { program_id: string; cpp_cents: number } => v.program_id != null && v.cpp_cents != null)
      .map((v) => [v.program_id, v as ValuationRow]),
  )
  const programMap = new Map<string, Program>(
    allPrograms.map((p) => [p.id, p as Program]),
  )
  const bonusMap = new Map<string, number>(
    activeBonusRows
      .filter((b): b is ActiveBonusRow => b.transfer_partner_id != null && b.bonus_pct != null)
      .map((b) => [b.transfer_partner_id, b.bonus_pct]),
  )

  const directOptionsByProgram = new Map<string, RedemptionOptionRow[]>()
  for (const row of redemptionOptionRows as RedemptionOptionRow[]) {
    const existing = directOptionsByProgram.get(row.program_id)
    if (existing) {
      existing.push(row)
    } else {
      directOptionsByProgram.set(row.program_id, [row])
    }
  }

  const partnersByFromProgram = new Map<string, TransferPartnerRow[]>()
  for (const row of transferPartnerRows as TransferPartnerRow[]) {
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
    return loadReferenceData(getDb())
  }

  const store = getReferenceCacheStore()
  const now = Date.now()
  const ttl = Number.isFinite(REFERENCE_CACHE_TTL_MS) && REFERENCE_CACHE_TTL_MS > 0
    ? REFERENCE_CACHE_TTL_MS
    : 120000

  if (store.data && store.expiresAt > now) return store.data
  if (store.pending) return store.pending

  store.pending = loadReferenceData(getDb())
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

function valueUnit(program: Program): 'cents' | 'paise' {
  return program.geography?.toUpperCase() === 'IN' ? 'paise' : 'cents'
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
      // Express the target's value in the balance's unit (paise for Indian
      // currencies, cents otherwise) so cross-region transfers compare fairly.
      const toCppCents = convertPointValue(
        resolveCppCents(toValuation?.cpp_cents, toProgram.type, toProgram.slug),
        valueUnit(toProgram),
        valueUnit(fromProgram),
      )
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
    options.sort((a, b) => b.total_value_cents - a.total_value_cents)

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
  results.sort((a, b) => b.total_value_cents - a.total_value_cents)

  // Label with the review dates of the valuations this result actually relies on.
  const usedProgramIds = new Set(
    results.flatMap((r) => [r.from_program.id, r.to_program?.id].filter((id): id is string => Boolean(id))),
  )
  const reviewDates = [...usedProgramIds].map((id) => referenceData.valuationMap.get(id)?.effective_date)
  const valuationSource = describeValuationReview(reviewDates) ?? 'Estimated values (no reviewed valuation on file)'

  return {
    total_cash_value_cents: cashBaselineAvailable ? totalCashValue : null,
    total_optimal_value_cents: totalOptimalValue,
    value_left_on_table_cents: cashBaselineAvailable ? totalOptimalValue - totalCashValue : null,
    cash_baseline_available: cashBaselineAvailable,
    results,
    valuation_source: valuationSource,
  }
}
