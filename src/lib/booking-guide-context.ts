import type { CabinClass } from '@/lib/award-search/types'

export type BookingGuideBalanceContext = {
  program_id?: string
  program_name: string
  balance: number
}

export type BookingGuideContext = {
  origin?: string
  destination?: string
  cabin?: CabinClass
  passengers?: number
  start_date?: string
  end_date?: string
  program_name?: string
  program_slug?: string
  estimated_miles?: number
  points_needed_from_wallet?: number
  transfer_chain?: string | null
  transfer_is_instant?: boolean
  has_real_availability?: boolean
  availability_date?: string | null
  deep_link_url?: string | null
  deep_link_label?: string | null
  balances?: BookingGuideBalanceContext[]
}

const IATA_RE = /^[A-Z]{3}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_BALANCE_ROWS = 12

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, maxLength)
  return trimmed || undefined
}

function cleanPositiveInt(value: unknown): number | undefined {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return undefined
  return num
}

export function sanitizeBookingGuideContext(input: unknown): BookingGuideContext | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>

  const origin = cleanString(raw.origin, 3)?.toUpperCase()
  const destination = cleanString(raw.destination, 3)?.toUpperCase()
  const cabin = raw.cabin
  const startDate = cleanString(raw.start_date, 10)
  const endDate = cleanString(raw.end_date, 10)
  const passengers = cleanPositiveInt(raw.passengers)
  const estimatedMiles = cleanPositiveInt(raw.estimated_miles)
  const pointsNeededFromWallet = cleanPositiveInt(raw.points_needed_from_wallet)

  const balances = Array.isArray(raw.balances)
    ? raw.balances
      .slice(0, MAX_BALANCE_ROWS)
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const row = entry as Record<string, unknown>
        const programName = cleanString(row.program_name, 120)
        const balance = cleanPositiveInt(row.balance)
        const programId = cleanString(row.program_id, 64)
        if (!programName || !balance) return null
        return {
          program_id: programId,
          program_name: programName,
          balance,
        } as BookingGuideBalanceContext
      })
      .filter((row): row is BookingGuideBalanceContext => row !== null)
    : undefined

  return {
    origin: origin && IATA_RE.test(origin) ? origin : undefined,
    destination: destination && IATA_RE.test(destination) ? destination : undefined,
    cabin:
      cabin === 'economy' || cabin === 'premium_economy' || cabin === 'business' || cabin === 'first'
        ? cabin
        : undefined,
    passengers,
    start_date: startDate && DATE_RE.test(startDate) ? startDate : undefined,
    end_date: endDate && DATE_RE.test(endDate) ? endDate : undefined,
    program_name: cleanString(raw.program_name, 120),
    program_slug: cleanString(raw.program_slug, 120),
    estimated_miles: estimatedMiles,
    points_needed_from_wallet: pointsNeededFromWallet,
    transfer_chain: cleanString(raw.transfer_chain, 280) ?? null,
    transfer_is_instant: typeof raw.transfer_is_instant === 'boolean' ? raw.transfer_is_instant : undefined,
    has_real_availability: typeof raw.has_real_availability === 'boolean' ? raw.has_real_availability : undefined,
    availability_date:
      cleanString(raw.availability_date, 10) && DATE_RE.test(String(raw.availability_date))
        ? String(raw.availability_date)
        : null,
    deep_link_url: cleanString(raw.deep_link_url, 2048) ?? null,
    deep_link_label: cleanString(raw.deep_link_label, 120) ?? null,
    balances: balances && balances.length > 0 ? balances : undefined,
  }
}

function formatBalances(context: BookingGuideContext): string[] {
  if (!context.balances || context.balances.length === 0) return []
  return context.balances.map(
    (row) => `- ${row.program_name}: ${row.balance.toLocaleString()} points`,
  )
}

export function buildBookingGuidePrompt(redemptionLabel: string, context: BookingGuideContext | null): string {
  const lines = [
    `Generate a concise 4-step checklist for booking this redemption: ${redemptionLabel}.`,
    '',
  ]

  if (context) {
    const facts: string[] = []
    if (context.origin && context.destination) {
      facts.push(`Route: ${context.origin} -> ${context.destination}`)
    }
    if (context.cabin) {
      facts.push(`Cabin: ${context.cabin}`)
    }
    if (context.passengers) {
      facts.push(`Passengers: ${context.passengers}`)
    }
    if (context.start_date && context.end_date) {
      facts.push(`Dates: ${context.start_date} to ${context.end_date}`)
    }
    if (context.program_name) {
      facts.push(`Target program: ${context.program_name}`)
    }
    if (context.estimated_miles) {
      facts.push(`Estimated award cost: ${context.estimated_miles.toLocaleString()} miles`)
    }
    if (context.points_needed_from_wallet) {
      facts.push(`Estimated points needed from wallet: ${context.points_needed_from_wallet.toLocaleString()}`)
    }
    if (context.transfer_chain) {
      facts.push(`Recommended transfer path: ${context.transfer_chain}`)
    }
    if (typeof context.transfer_is_instant === 'boolean') {
      facts.push(`Transfer timing: ${context.transfer_is_instant ? 'instant' : 'not instant'}`)
    }
    if (typeof context.has_real_availability === 'boolean') {
      facts.push(`Availability source: ${context.has_real_availability ? 'live availability found' : 'chart estimate only'}`)
    }
    if (context.availability_date) {
      facts.push(`Best available date: ${context.availability_date}`)
    }
    if (context.deep_link_label || context.deep_link_url) {
      facts.push(`Booking link: ${context.deep_link_label ?? 'booking portal'}${context.deep_link_url ? ` (${context.deep_link_url})` : ''}`)
    }

    if (facts.length > 0) {
      lines.push('Use this booking context:')
      lines.push(...facts.map((fact) => `- ${fact}`))
      lines.push('')
    }

    const balanceLines = formatBalances(context)
    if (balanceLines.length > 0) {
      lines.push('User wallet balances:')
      lines.push(...balanceLines)
      lines.push('')
    }
  }

  lines.push('Requirements:')
  lines.push('- Focus on practical transfer and booking actions.')
  lines.push('- Use the provided transfer path, availability facts, and balances when they exist.')
  lines.push('- Call out if the transfer is not instant or the result is estimate-only.')
  lines.push('- One step per line.')
  lines.push('- Start each line with "Step X:".')
  lines.push('- Do not include markdown or extra commentary.')

  return lines.join('\n')
}
