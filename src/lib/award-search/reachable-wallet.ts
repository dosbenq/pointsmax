import type { ProgramRow, TransferPartnerRow } from './types'

type BalanceInput = { program_id: string; amount: number }

export interface ReachableContributor {
  sourceProgram: ProgramRow
  balance: number
  availableMiles: number
  ratioFrom: number
  ratioTo: number
  isInstant: boolean
  transferTimeMaxHrs: number
  directHold: boolean
}

export interface ReachablePath {
  contributors: ReachableContributor[]
  availableMiles: number
  transferIsInstant: boolean
  transferTimeMaxHrs: number
}

function contributorSortValue(contributor: ReachableContributor): number {
  return contributor.ratioTo / contributor.ratioFrom
}

function mergeContributors(existing: ReachableContributor[], next: ReachableContributor): ReachableContributor[] {
  const merged = [...existing, next]
  merged.sort((a, b) => {
    const valueDiff = contributorSortValue(b) - contributorSortValue(a)
    if (valueDiff !== 0) return valueDiff
    return b.availableMiles - a.availableMiles
  })
  return merged
}

export function buildReachablePaths(
  balances: BalanceInput[],
  programMap: Map<string, ProgramRow>,
  transferPartners: TransferPartnerRow[],
): Map<string, ReachablePath> {
  const balanceMap = new Map<string, number>(balances.map((balance) => [balance.program_id, balance.amount]))
  const pathBySlug = new Map<string, ReachablePath>()

  const appendContributor = (targetSlug: string, contributor: ReachableContributor) => {
    const existing = pathBySlug.get(targetSlug)
    const contributors = mergeContributors(existing?.contributors ?? [], contributor)
    const availableMiles = contributors.reduce((sum, item) => sum + item.availableMiles, 0)
    pathBySlug.set(targetSlug, {
      contributors,
      availableMiles,
      transferIsInstant: contributors.every((item) => item.directHold || item.isInstant),
      transferTimeMaxHrs: contributors.reduce((max, item) => Math.max(max, item.transferTimeMaxHrs), 0),
    })
  }

  for (const balance of balances) {
    const program = programMap.get(balance.program_id)
    if (!program || program.type !== 'airline_miles' || balance.amount <= 0) continue
    appendContributor(program.slug, {
      sourceProgram: program,
      balance: balance.amount,
      availableMiles: balance.amount,
      ratioFrom: 1,
      ratioTo: 1,
      isInstant: true,
      transferTimeMaxHrs: 0,
      directHold: true,
    })
  }

  for (const partner of transferPartners) {
    const toProgram = programMap.get(partner.to_program_id)
    if (!toProgram || toProgram.type !== 'airline_miles') continue

    const sourceProgram = programMap.get(partner.from_program_id)
    const balance = balanceMap.get(partner.from_program_id) ?? 0
    const availableMiles = Math.floor(balance * (partner.ratio_to / partner.ratio_from))
    if (!sourceProgram || balance <= 0 || availableMiles <= 0) continue

    appendContributor(toProgram.slug, {
      sourceProgram,
      balance,
      availableMiles,
      ratioFrom: partner.ratio_from,
      ratioTo: partner.ratio_to,
      isInstant: partner.is_instant,
      transferTimeMaxHrs: partner.transfer_time_max_hrs,
      directHold: false,
    })
  }

  return pathBySlug
}

export function calculatePointsNeededFromWallet(path: ReachablePath, requiredMiles: number): number {
  let remaining = requiredMiles
  let pointsNeeded = 0

  for (const contributor of path.contributors) {
    if (remaining <= 0) break
    const milesUsed = Math.min(remaining, contributor.availableMiles)
    pointsNeeded += contributor.directHold
      ? milesUsed
      : Math.ceil(milesUsed * (contributor.ratioFrom / contributor.ratioTo))
    remaining -= milesUsed
  }

  if (remaining > 0 && path.contributors[0]) {
    const best = path.contributors[0]
    pointsNeeded += best.directHold
      ? remaining
      : Math.ceil(remaining * (best.ratioFrom / best.ratioTo))
  }

  return pointsNeeded
}

export function buildTransferChain(path: ReachablePath, airlineProgram: ProgramRow): string | null {
  if (path.contributors.length === 0) return null
  if (path.contributors.length === 1 && path.contributors[0].directHold) return null

  const parts = path.contributors.map((contributor) => {
    if (contributor.directHold) return `${contributor.sourceProgram.name} balance`
    const ratio =
      contributor.ratioFrom === contributor.ratioTo
        ? '1:1'
        : `${contributor.ratioFrom}:${contributor.ratioTo}`
    return `${contributor.sourceProgram.name} (${ratio})`
  })

  return `${parts.join(' + ')} → ${airlineProgram.name}`
}
