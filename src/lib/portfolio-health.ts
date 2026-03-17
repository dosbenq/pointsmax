type PortfolioProgram = {
  id: string
  name: string
  type: string
}

type PortfolioTransferPartner = {
  from_program_id: string
  to_program_id: string
}

type PortfolioBalance = {
  program_id: string
  amount: number
}

export type PortfolioFlag =
  | { type: 'over_concentrated'; program_name: string; pct: number }
  | { type: 'no_transfer_partners' }
  | { type: 'stranded_miles'; program_name: string; balance: number; minimum_redemption: number }
  | { type: 'missing_hotel_program' }

export type PortfolioHealthReport = {
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  recommendations: string[]
  flags: PortfolioFlag[]
}

function clampScore(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value)
}

function gradeForScore(score: number): PortfolioHealthReport['grade'] {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  return 'D'
}

function buildRecommendations(flags: PortfolioFlag[]): string[] {
  return flags.map((flag) => {
    switch (flag.type) {
      case 'over_concentrated':
        return `${flag.pct}% of your wallet sits in ${flag.program_name}. Consider diversifying into a second transferable currency or a hotel program.`
      case 'no_transfer_partners':
        return 'Your wallet lacks a strong transferable currency. Add one flexible points program so you can route value into the best redemption instead of the only redemption.'
      case 'stranded_miles':
        return `${flag.program_name} looks stranded at ${flag.balance.toLocaleString()} points. Top it up, transfer into it, or burn it before it becomes dead weight.`
      case 'missing_hotel_program':
        return 'You do not have a hotel-side anchor in the wallet. Adding one can improve flexibility when flight pricing is weak.'
    }
  })
}

export function analyzePortfolioHealth(
  balances: PortfolioBalance[],
  programs: PortfolioProgram[],
  transferPartners: PortfolioTransferPartner[],
): PortfolioHealthReport {
  const cleanedBalances = balances
    .map((balance) => ({
      program_id: balance.program_id,
      amount: Math.max(0, Math.round(Number(balance.amount) || 0)),
    }))
    .filter((balance) => balance.amount > 0)

  if (cleanedBalances.length === 0) {
    return {
      score: 0,
      grade: 'D',
      recommendations: ['Add at least one program balance before evaluating portfolio health.'],
      flags: [{ type: 'no_transfer_partners' }, { type: 'missing_hotel_program' }],
    }
  }

  const programById = new Map(programs.map((program) => [program.id, program]))
  const totalBalance = cleanedBalances.reduce((sum, balance) => sum + balance.amount, 0)
  const flags: PortfolioFlag[] = []
  let score = 100

  const largestBalance = [...cleanedBalances].sort((left, right) => right.amount - left.amount)[0]
  const concentrationPct = Math.round((largestBalance.amount / totalBalance) * 100)
  if (concentrationPct > 65) {
    score -= 20
    flags.push({
      type: 'over_concentrated',
      program_name: programById.get(largestBalance.program_id)?.name ?? 'one program',
      pct: concentrationPct,
    })
  }

  const hasTransferableCurrency = cleanedBalances.some((balance) => {
    const type = programById.get(balance.program_id)?.type
    return type === 'transferable_points'
  })
  if (!hasTransferableCurrency) {
    score -= 15
    flags.push({ type: 'no_transfer_partners' })
  }

  const hasHotelProgram = cleanedBalances.some((balance) => {
    const type = programById.get(balance.program_id)?.type
    return type === 'hotel_points'
  })
  const canReachHotelProgram = hasTransferableCurrency && transferPartners.some((partner) => {
    const fromType = programById.get(partner.from_program_id)?.type
    const toType = programById.get(partner.to_program_id)?.type
    return fromType === 'transferable_points' && toType === 'hotel_points'
  })
  if (!hasHotelProgram && !canReachHotelProgram) {
    score -= 10
    flags.push({ type: 'missing_hotel_program' })
  }

  for (const balance of cleanedBalances) {
    const program = programById.get(balance.program_id)
    if (!program) continue
    if (program.type === 'transferable_points') continue

    const minimumRedemption = program.type === 'hotel_points' ? 15000 : 10000
    const hasOutboundPath = transferPartners.some((partner) => partner.from_program_id === balance.program_id)
    if (balance.amount < minimumRedemption && !hasOutboundPath) {
      score -= 10
      flags.push({
        type: 'stranded_miles',
        program_name: program.name,
        balance: balance.amount,
        minimum_redemption: minimumRedemption,
      })
    }
  }

  const finalScore = clampScore(score)
  const uniqueRecommendations = [...new Set(buildRecommendations(flags))].slice(0, 3)

  return {
    score: finalScore,
    grade: gradeForScore(finalScore),
    recommendations: uniqueRecommendations.length > 0 ? uniqueRecommendations : ['Your wallet is balanced enough that the next gains are likely tactical rather than structural.'],
    flags,
  }
}
