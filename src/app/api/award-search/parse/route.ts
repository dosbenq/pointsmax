import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getGeminiModelCandidatesForApiKey, isGeminiDisabled, markGeminiModelUnavailable } from '@/lib/gemini-models'
import { getRequestId, logError, logWarn } from '@/lib/logger'

type ParseResponseParams = {
  origin?: string | null
  destination?: string | null
  cabin?: 'economy' | 'premium_economy' | 'business' | 'first' | null
  start_date?: string | null
  end_date?: string | null
  passengers?: number | null
}

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

const CITY_TO_IATA: Record<string, string> = {
  tokyo: 'HND',
  london: 'LHR',
  paris: 'CDG',
  dubai: 'DXB',
  singapore: 'SIN',
  delhi: 'DEL',
  mumbai: 'BOM',
  bangalore: 'BLR',
  'new york': 'JFK',
  'san francisco': 'SFO',
}

function asIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function sanitizeIata(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null
}

function sanitizeCabin(value: unknown): ParseResponseParams['cabin'] {
  if (value === 'economy' || value === 'premium_economy' || value === 'business' || value === 'first') {
    return value
  }
  return null
}

function sanitizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : trimmed
}

function sanitizePassengers(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isInteger(value) || value < 1 || value > 9) return null
  return value
}

function sanitizeParsedParams(value: unknown): ParseResponseParams {
  if (!value || typeof value !== 'object') return {}
  const row = value as Record<string, unknown>
  return {
    origin: sanitizeIata(row.origin),
    destination: sanitizeIata(row.destination),
    cabin: sanitizeCabin(row.cabin),
    start_date: sanitizeDate(row.start_date),
    end_date: sanitizeDate(row.end_date),
    passengers: sanitizePassengers(row.passengers),
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

function inferCabin(query: string): ParseResponseParams['cabin'] {
  if (/\bfirst\b/i.test(query)) return 'first'
  if (/premium economy|premium-economy/i.test(query)) return 'premium_economy'
  if (/\bbusiness\b/i.test(query)) return 'business'
  if (/\beconomy\b/i.test(query)) return 'economy'
  return null
}

function inferPassengers(query: string): number | null {
  const match = query.match(/\b([1-9])\s+(passenger|people|travelers|travellers|seats?)\b/i)
  return match ? Number.parseInt(match[1], 10) : null
}

function inferMonthRange(query: string): Pick<ParseResponseParams, 'start_date' | 'end_date'> {
  const now = new Date()
  const lowered = query.toLowerCase()
  for (const [monthName, monthIndex] of Object.entries(MONTH_INDEX)) {
    if (!lowered.includes(monthName)) continue
    const year = monthIndex < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear()
    const start = new Date(Date.UTC(year, monthIndex, 1))
    const end = new Date(Date.UTC(year, monthIndex + 1, 0))
    return { start_date: asIsoDate(start), end_date: asIsoDate(end) }
  }
  return {}
}

function inferDestination(query: string): string | null {
  const fromToMatch = query.match(/\bto\s+([a-z\s]+?)(?:\s+in\s+|\s+for\s+|\s+with\s+|$)/i)
  const destinationText = fromToMatch?.[1]?.trim().toLowerCase()
  if (destinationText && CITY_TO_IATA[destinationText]) {
    return CITY_TO_IATA[destinationText]
  }

  for (const [city, iata] of Object.entries(CITY_TO_IATA)) {
    if (query.toLowerCase().includes(city)) {
      return iata
    }
  }
  return null
}

function inferOrigin(query: string, homeAirport?: string | null): string | null {
  const match = query.match(/\bfrom\s+([A-Z]{3})\b/)
  if (match) return sanitizeIata(match[1])
  return sanitizeIata(homeAirport ?? null)
}

function heuristicParseQuery(query: string, homeAirport?: string | null): ParseResponseParams {
  return {
    origin: inferOrigin(query, homeAirport),
    destination: inferDestination(query),
    cabin: inferCabin(query),
    passengers: inferPassengers(query) ?? 1,
    ...inferMonthRange(query),
  }
}

async function parseWithGemini(query: string, homeAirport?: string | null): Promise<ParseResponseParams | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || isGeminiDisabled()) return null

  const genAI = new GoogleGenerativeAI(apiKey)
  const candidates = await getGeminiModelCandidatesForApiKey(apiKey)
  const today = new Date().toISOString().slice(0, 10)
  const prompt = [
    'Convert this travel-planning request into award search parameters.',
    `Today is ${today}.`,
    homeAirport ? `Home airport: ${homeAirport}.` : 'Home airport: unknown.',
    'Return JSON only with keys: origin, destination, cabin, start_date, end_date, passengers.',
    'Use IATA airport codes for origin and destination.',
    'Valid cabin values: economy, premium_economy, business, first.',
    `Query: ${query}`,
  ].join('\n')

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const response = await model.generateContent(prompt)
      const text = response.response.text()
      const parsed = extractJsonObject(text)
      if (parsed) return sanitizeParsedParams(parsed)
    } catch (error) {
      markGeminiModelUnavailable(modelName, error)
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)

  const sizeError = enforceJsonContentLength(req, 10_000)
  if (sizeError) return sizeError

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'award_search_parse_ip',
    maxRequests: 20,
    windowMs: 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const query = typeof payload.query === 'string' ? payload.query.trim() : ''
  const homeAirport = typeof payload.home_airport === 'string' ? payload.home_airport.trim().toUpperCase() : null

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    const geminiParsed = await parseWithGemini(query, homeAirport)
    const parsed = geminiParsed ?? heuristicParseQuery(query, homeAirport)
    const sanitized = sanitizeParsedParams(parsed)
    const confidence = sanitized.origin && sanitized.destination && sanitized.cabin ? 'high' : 'low'

    return NextResponse.json({
      params: sanitized,
      confidence,
    })
  } catch (error) {
    logError('award_search_parse_failed', {
      requestId,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    logWarn('award_search_parse_fallback', { requestId })

    const fallback = sanitizeParsedParams(heuristicParseQuery(query, homeAirport))
    return NextResponse.json({
      params: fallback,
      confidence: fallback.origin && fallback.destination && fallback.cabin ? 'high' : 'low',
    })
  }
}
