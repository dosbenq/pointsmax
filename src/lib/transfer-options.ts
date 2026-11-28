// ============================================================
// What your points become: for each airline program reachable from the
// wallet, the exact conversion (transfer ratio and any verified bonus
// running today) and the path to get there. Facts only: no award prices,
// cents-per-point or cash values. Seat availability is not checked here.
// ============================================================

import { getCatalogPrograms, getCatalogTransferPartners } from '@/lib/catalog'
import type { ActiveTransferBonus } from '@/lib/transfer-bonuses'

export type WalletBalance = { program_id: string; amount: number }

export type TransferPath = {
  from_program_id: string
  from_program_name: string
  points: number
  ratio_from: number
  ratio_to: number
  /** null when the transfer is instant or the time is unknown */
  transfer_time_max_hrs: number | null
  is_instant: boolean
  bonus_pct: number | null
  bonus_ends: string | null
  /** Miles that arrive in the airline program after ratio and bonus. */
  miles: number
}

export type TransferOption = {
  program_id: string
  program_slug: string
  program_name: string
  color_hex: string | null
  /** Miles already held in this airline program. */
  miles_held: number
  paths: TransferPath[]
  /** miles_held plus everything every path can deliver. */
  miles_available: number
}

/** Miles that arrive for `points` sent at ratio_from:ratio_to, plus a bonus. Transfers move whole blocks. */
export function convert(points: number, ratioFrom: number, ratioTo: number, bonusPct: number | null): number {
  if (!(points > 0) || !(ratioFrom > 0) || !(ratioTo > 0)) return 0
  const blocks = Math.floor(points / ratioFrom)
  const base = blocks * ratioTo
  return Math.floor(base * (1 + (bonusPct ?? 0) / 100))
}

export function buildTransferOptions(
  balances: WalletBalance[],
  region: 'US' | 'IN',
  bonuses: ActiveTransferBonus[] = [],
): TransferOption[] {
  const programs = getCatalogPrograms({ includeInactive: false })
  const programById = new Map(programs.map((program) => [program.id, program]))
  const regionAirlines = new Set(getCatalogPrograms({ geography: region }).filter((p) => p.type === 'airline_miles').map((p) => p.id))

  const pointsByProgram = new Map<string, number>()
  for (const { program_id, amount } of balances) {
    if (!programById.has(program_id) || !(amount > 0)) continue
    pointsByProgram.set(program_id, (pointsByProgram.get(program_id) ?? 0) + Math.floor(amount))
  }

  // Strongest verified bonus per transfer partner.
  const bonusByPartner = new Map<string, ActiveTransferBonus>()
  for (const bonus of bonuses) {
    const current = bonusByPartner.get(bonus.transfer_partner_id)
    if (!current || bonus.bonus_pct > current.bonus_pct) bonusByPartner.set(bonus.transfer_partner_id, bonus)
  }

  const options = new Map<string, TransferOption>()
  const optionFor = (programId: string): TransferOption => {
    let option = options.get(programId)
    if (!option) {
      const program = programById.get(programId)!
      option = {
        program_id: program.id,
        program_slug: program.slug,
        program_name: program.name,
        color_hex: program.color_hex ?? null,
        miles_held: 0,
        paths: [],
        miles_available: 0,
      }
      options.set(programId, option)
    }
    return option
  }

  for (const [programId, points] of pointsByProgram) {
    if (regionAirlines.has(programId)) optionFor(programId).miles_held = points
  }

  for (const partner of getCatalogTransferPartners()) {
    if (partner.is_active === false) continue
    const points = pointsByProgram.get(partner.from_program_id)
    const target = programById.get(partner.to_program_id)
    const source = programById.get(partner.from_program_id)
    if (!points || !target || !source || !regionAirlines.has(target.id)) continue

    const bonus = bonusByPartner.get(partner.id) ?? null
    const miles = convert(points, partner.ratio_from, partner.ratio_to, bonus?.bonus_pct ?? null)
    if (miles <= 0) continue
    optionFor(target.id).paths.push({
      from_program_id: source.id,
      from_program_name: source.name,
      points,
      ratio_from: partner.ratio_from,
      ratio_to: partner.ratio_to,
      transfer_time_max_hrs: partner.is_instant ? null : partner.transfer_time_max_hrs ?? null,
      is_instant: Boolean(partner.is_instant),
      bonus_pct: bonus?.bonus_pct ?? null,
      bonus_ends: bonus?.end_date ?? null,
      miles,
    })
  }

  return [...options.values()]
    .map((option) => ({
      ...option,
      paths: option.paths.sort((a, b) => b.miles - a.miles),
      miles_available: option.miles_held + option.paths.reduce((sum, path) => sum + path.miles, 0),
    }))
    .sort((a, b) =>
      Number(b.paths.some((p) => p.bonus_pct)) - Number(a.paths.some((p) => p.bonus_pct))
      || b.miles_available - a.miles_available
      || a.program_name.localeCompare(b.program_name))
}
