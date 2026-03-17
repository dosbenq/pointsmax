import type { TransferPartnerRow, ProgramRow } from './types'

type BalanceInput = { program_id: string; amount: number }

const MAX_TRANSFER_HOPS = 3

export interface ReachableContributor {
  sourceProgram: ProgramRow
  balance: number
  availableMiles: number
  walletPointsPerTargetMile: number
  isInstant: boolean
  transferTimeMaxHrs: number
  directHold: boolean
  hopCount: number
  pathProgramNames: string[]
}

export interface ReachablePath {
  contributors: ReachableContributor[]
  availableMiles: number
  transferIsInstant: boolean
  transferTimeMaxHrs: number
}

type ExplorationState = {
  currentProgramId: string
  availableMiles: number
  walletPointsPerTargetMile: number
  isInstant: boolean
  transferTimeMaxHrs: number
  hopCount: number
  pathProgramIds: string[]
  pathProgramNames: string[]
}

function contributorSortValue(contributor: ReachableContributor): number {
  return contributor.walletPointsPerTargetMile
}

function mergeContributors(existing: ReachableContributor[], next: ReachableContributor): ReachableContributor[] {
  const merged = [...existing, next]
  merged.sort((a, b) => {
    const valueDiff = contributorSortValue(a) - contributorSortValue(b)
    if (valueDiff !== 0) return valueDiff
    return b.availableMiles - a.availableMiles
  })
  return merged
}

function chooseBetterContributor(
  current: ReachableContributor | undefined,
  candidate: ReachableContributor,
): ReachableContributor {
  if (!current) return candidate
  if (candidate.availableMiles !== current.availableMiles) {
    return candidate.availableMiles > current.availableMiles ? candidate : current
  }
  if (candidate.walletPointsPerTargetMile !== current.walletPointsPerTargetMile) {
    return candidate.walletPointsPerTargetMile < current.walletPointsPerTargetMile ? candidate : current
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

function buildAdjacency(transferPartners: TransferPartnerRow[]): Map<string, TransferPartnerRow[]> {
  const adjacency = new Map<string, TransferPartnerRow[]>()
  for (const row of transferPartners) {
    const existing = adjacency.get(row.from_program_id)
    if (existing) {
      existing.push(row)
    } else {
      adjacency.set(row.from_program_id, [row])
    }
  }
  return adjacency
}

function exploreContributorsForBalance(
  balance: BalanceInput,
  programMap: Map<string, ProgramRow>,
  adjacency: Map<string, TransferPartnerRow[]>,
): Array<{ targetSlug: string; contributor: ReachableContributor }> {
  const sourceProgram = programMap.get(balance.program_id)
  if (!sourceProgram || balance.amount <= 0) return []

  const bestByTargetSlug = new Map<string, ReachableContributor>()
  const seedState: ExplorationState = {
    currentProgramId: sourceProgram.id,
    availableMiles: balance.amount,
    walletPointsPerTargetMile: 1,
    isInstant: true,
    transferTimeMaxHrs: 0,
    hopCount: 0,
    pathProgramIds: [sourceProgram.id],
    pathProgramNames: [sourceProgram.name],
  }

  bestByTargetSlug.set(sourceProgram.slug, {
    sourceProgram,
    balance: balance.amount,
    availableMiles: balance.amount,
    walletPointsPerTargetMile: 1,
    isInstant: true,
    transferTimeMaxHrs: 0,
    directHold: true,
    hopCount: 0,
    pathProgramNames: [sourceProgram.name],
  })

  const queue: ExplorationState[] = [seedState]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || current.hopCount >= MAX_TRANSFER_HOPS) continue

    const edges = adjacency.get(current.currentProgramId) ?? []
    for (const edge of edges) {
      if (current.pathProgramIds.includes(edge.to_program_id)) continue

      const nextProgram = programMap.get(edge.to_program_id)
      if (!nextProgram) continue

      const nextAvailableMiles = Math.floor(current.availableMiles * (edge.ratio_to / edge.ratio_from))
      if (nextAvailableMiles <= 0) continue

      const nextState: ExplorationState = {
        currentProgramId: nextProgram.id,
        availableMiles: nextAvailableMiles,
        walletPointsPerTargetMile:
          current.walletPointsPerTargetMile * (edge.ratio_from / edge.ratio_to),
        isInstant: current.isInstant && edge.is_instant,
        transferTimeMaxHrs: Math.max(current.transferTimeMaxHrs, edge.transfer_time_max_hrs),
        hopCount: current.hopCount + 1,
        pathProgramIds: [...current.pathProgramIds, nextProgram.id],
        pathProgramNames: [...current.pathProgramNames, nextProgram.name],
      }

      const candidateContributor: ReachableContributor = {
        sourceProgram,
        balance: balance.amount,
        availableMiles: nextAvailableMiles,
        walletPointsPerTargetMile: nextState.walletPointsPerTargetMile,
        isInstant: nextState.isInstant,
        transferTimeMaxHrs: nextState.transferTimeMaxHrs,
        directHold: false,
        hopCount: nextState.hopCount,
        pathProgramNames: nextState.pathProgramNames,
      }

      const targetSlug = nextProgram.slug
      bestByTargetSlug.set(
        targetSlug,
        chooseBetterContributor(bestByTargetSlug.get(targetSlug), candidateContributor),
      )

      queue.push(nextState)
    }
  }

  return [...bestByTargetSlug.entries()].map(([targetSlug, contributor]) => ({
    targetSlug,
    contributor,
  }))
}

export function buildReachablePaths(
  balances: BalanceInput[],
  programMap: Map<string, ProgramRow>,
  transferPartners: TransferPartnerRow[],
): Map<string, ReachablePath> {
  const pathBySlug = new Map<string, ReachablePath>()
  const adjacency = buildAdjacency(transferPartners)

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
    const contributors = exploreContributorsForBalance(balance, programMap, adjacency)
    for (const { targetSlug, contributor } of contributors) {
      appendContributor(targetSlug, contributor)
    }
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
      : Math.ceil(milesUsed * contributor.walletPointsPerTargetMile)
    remaining -= milesUsed
  }

  if (remaining > 0 && path.contributors[0]) {
    const best = path.contributors[0]
    pointsNeeded += best.directHold
      ? remaining
      : Math.ceil(remaining * best.walletPointsPerTargetMile)
  }

  return pointsNeeded
}

export function buildTransferChain(path: ReachablePath): string | null {
  if (path.contributors.length === 0) return null
  if (path.contributors.length === 1 && path.contributors[0].directHold) return null

  const parts = path.contributors.map((contributor) => {
    if (contributor.directHold) return `${contributor.sourceProgram.name} balance`
    const chain = contributor.pathProgramNames.join(' → ')
    return contributor.hopCount > 1 ? `${chain} (${contributor.hopCount} hops)` : chain
  })

  return parts.join(' + ')
}
