import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AwardNarrative, AwardSearchParams, AwardSearchResult, CabinClass } from '@/lib/award-search'
import { getGeminiModelCandidatesForApiKey, isGeminiDisabled, markGeminiModelUnavailable } from '@/lib/gemini-models'

const IATA_RE = /^[A-Z]{3}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CABIN_VALUES = ['economy', 'premium_economy', 'business', 'first'] as const
const MAX_BALANCE_ROWS = 25
const MAX_SEARCH_SPAN_DAYS = 45

export const MAX_AWARD_SEARCH_BODY_BYTES = 48_000
export const ESTIMATES_ONLY_MESSAGE = 'Live award availability is not configured. Showing chart estimates only.'

export type AwardNarrativeParams = Pick<
  AwardSearchParams,
  'origin' | 'destination' | 'cabin' | 'passengers' | 'start_date' | 'end_date'
>

export type AwardNarrativeOption = Pick<
  AwardSearchResult,
  | 'program_slug'
  | 'program_name'
  | 'estimated_miles'
  | 'estimated_cash_value_cents'
  | 'transfer_chain'
  | 'has_real_availability'
  | 'is_reachable'
>

function currentUtcDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function validateRouteParams(input: Record<string, unknown>): AwardNarrativeParams | { error: string } {
  const origin = typeof input.origin === 'string' ? input.origin.toUpperCase().trim() : ''
  const destination = typeof input.destination === 'string' ? input.destination.toUpperCase().trim() : ''
  if (!IATA_RE.test(origin)) return { error: 'origin must be a 3-letter IATA airport code' }
  if (!IATA_RE.test(destination)) return { error: 'destination must be a 3-letter IATA airport code' }
  if (origin === destination) return { error: 'origin and destination must be different airports' }

  const cabin = input.cabin as string
  if (!CABIN_VALUES.includes(cabin as typeof CABIN_VALUES[number])) {
    return { error: `cabin must be one of: ${CABIN_VALUES.join(', ')}` }
  }

  const passengers = Number(input.passengers)
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return { error: 'passengers must be an integer between 1 and 9' }
  }

  const start_date = typeof input.start_date === 'string' ? input.start_date : ''
  const end_date = typeof input.end_date === 'string' ? input.end_date : ''
  if (!DATE_RE.test(start_date)) return { error: 'start_date must be YYYY-MM-DD' }
  if (!DATE_RE.test(end_date)) return { error: 'end_date must be YYYY-MM-DD' }
  if (start_date < currentUtcDateString()) return { error: 'start_date must be today or later' }
  if (end_date < start_date) return { error: 'end_date must be on or after start_date' }
  const startMs = Date.parse(`${start_date}T00:00:00Z`)
  const endMs = Date.parse(`${end_date}T00:00:00Z`)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { error: 'Invalid start_date or end_date' }
  }
  const spanDays = (endMs - startMs) / (24 * 60 * 60 * 1000) + 1
  if (spanDays > MAX_SEARCH_SPAN_DAYS) {
    return { error: `Date range too wide. Max ${MAX_SEARCH_SPAN_DAYS} days.` }
  }

  return {
    origin,
    destination,
    cabin: cabin as CabinClass,
    passengers,
    start_date,
    end_date,
  }
}

export function validateSearchParams(body: unknown): AwardSearchParams | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const b = body as Record<string, unknown>

  const routeParams = validateRouteParams(b)
  if ('error' in routeParams) return routeParams

  const balances = b.balances
  if (!Array.isArray(balances) || balances.length === 0) {
    return { error: 'balances must be a non-empty array' }
  }
  if (balances.length > MAX_BALANCE_ROWS) {
    return { error: `balances can include at most ${MAX_BALANCE_ROWS} rows` }
  }
  for (const bal of balances) {
    if (!bal || typeof bal !== 'object') return { error: 'Invalid balance entry' }
    const row = bal as Record<string, unknown>
    if (typeof row.program_id !== 'string' || !UUID_RE.test(row.program_id)) {
      return { error: 'Each balance must have a program_id' }
    }
    if (typeof row.amount !== 'number' || row.amount <= 0 || row.amount > 100_000_000) {
      return { error: 'Each balance amount must be a positive number' }
    }
  }

  return {
    ...routeParams,
    balances: balances as AwardSearchParams['balances'],
  }
}

export function shouldGenerateNarrative(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true
  const includeNarrative = (body as Record<string, unknown>).include_narrative
  return includeNarrative !== false
}

export function pickNarrativeOptions(results: AwardSearchResult[]): AwardNarrativeOption[] {
  return results.slice(0, 8).map((row) => ({
    program_slug: row.program_slug,
    program_name: row.program_name,
    estimated_miles: row.estimated_miles,
    estimated_cash_value_cents: row.estimated_cash_value_cents,
    transfer_chain: row.transfer_chain,
    has_real_availability: row.has_real_availability,
    is_reachable: row.is_reachable,
  }))
}

export function parseNarrativeParamsParam(raw: string | null): AwardNarrativeParams | { error: string } {
  if (!raw) return { error: 'params query parameter is required' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'params must be valid JSON' }
  }
  if (!parsed || typeof parsed !== 'object') return { error: 'params must be an object' }
  return validateRouteParams(parsed as Record<string, unknown>)
}

export function parseNarrativeOptionsParam(raw: string | null): AwardNarrativeOption[] | { error: string } {
  if (!raw) return { error: 'results query parameter is required' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'results must be valid JSON' }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { error: 'results must be a non-empty array' }
  }

  const options: AwardNarrativeOption[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') return { error: 'results contains an invalid row' }
    const row = item as Record<string, unknown>
    const program_slug = typeof row.program_slug === 'string' ? row.program_slug : ''
    const program_name = typeof row.program_name === 'string' ? row.program_name : ''
    const estimated_miles = Number(row.estimated_miles)
    const estimated_cash_value_cents = Number(row.estimated_cash_value_cents)
    const transfer_chain = typeof row.transfer_chain === 'string' ? row.transfer_chain : null
    const has_real_availability = Boolean(row.has_real_availability)
    const is_reachable = Boolean(row.is_reachable)

    if (!program_slug || !program_name) {
      return { error: 'results contains rows missing required fields' }
    }
    if (!Number.isFinite(estimated_miles) || estimated_miles <= 0) {
      return { error: 'results contains invalid estimated_miles values' }
    }
    if (!Number.isFinite(estimated_cash_value_cents) || estimated_cash_value_cents <= 0) {
      return { error: 'results contains invalid estimated_cash_value_cents values' }
    }

    options.push({
      program_slug,
      program_name,
      estimated_miles: Math.round(estimated_miles),
      estimated_cash_value_cents: Math.round(estimated_cash_value_cents),
      transfer_chain,
      has_real_availability,
      is_reachable,
    })
  }

  return options.slice(0, 8)
}

const narrativeCache = new Map<string, { narrative: AwardNarrative; expiresAt: number }>()
const NARRATIVE_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function generateNarrative(
  params: AwardNarrativeParams,
  options: AwardNarrativeOption[],
): Promise<AwardNarrative | null> {
  if (isGeminiDisabled()) return null
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  // Cache key based on simplified params and top options
  const cacheKey = JSON.stringify({ params, options })
  const cached = narrativeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.narrative
  }

  try {
    const resultsSummary = options.map((r) => {
      const reachable = r.is_reachable ? 'REACHABLE' : 'NOT REACHABLE'
      const avail = r.has_real_availability ? '(live availability)' : '(estimate)'
      const chain = r.transfer_chain ? ` via ${r.transfer_chain}` : ' (direct)'
      const dollarVal = (r.estimated_cash_value_cents / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      })
      return `- ${r.program_name}: ${r.estimated_miles.toLocaleString()} miles${chain} — ${dollarVal} est. value ${avail} — ${reachable}`
    }).join('\n')

    const prompt = `You are a travel rewards expert. A user wants to fly:
Route: ${params.origin} → ${params.destination}
Cabin: ${params.cabin}
Passengers: ${params.passengers}
Dates: ${params.start_date} to ${params.end_date}

Top award options found:
${resultsSummary}

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "headline": "One punchy line under 10 words summarizing the best option",
  "body": "2–3 sentence explanation of the top pick, why it's best, and any caveats",
  "top_pick_slug": "the program_slug of the #1 recommendation",
  "warnings": ["Any warnings e.g. availability, transfer times, expiry risks"],
  "booking_tips": ["Specific actionable tip 1", "Tip 2", "Tip 3"]
}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const candidates = await getGeminiModelCandidatesForApiKey(apiKey)
    let lastErr: unknown = null

    for (const modelName of candidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const response = await model.generateContent(prompt)
        const text = response.response.text()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return null
        const result = JSON.parse(jsonMatch[0]) as AwardNarrative
        narrativeCache.set(cacheKey, {
          narrative: result,
          expiresAt: Date.now() + NARRATIVE_CACHE_TTL_MS,
        })
        return result
      } catch (err) {
        markGeminiModelUnavailable(modelName, err)
        lastErr = err
      }
    }

    console.error('[AwardSearch] All Gemini model candidates failed:', lastErr)
    return null
  } catch (err) {
    console.error('[AwardSearch] Narrative generation failed:', err)
    return null
  }
}
