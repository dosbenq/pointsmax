// ============================================================
// POST /api/trip-builder
// Full AI trip planning: award search + Gemini hotel/steps
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerDbClient } from '@/lib/supabase'
import { AwardProviderUnavailableError, createAwardProvider } from '@/lib/award-search'
import type { AwardSearchParams } from '@/lib/award-search'
import type { TripBuilderResponse, TripBuilderFlightOption } from '@/types/database'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'
import { getGeminiModelCandidatesForApiKey, isGeminiDisabled, markGeminiModelUnavailable } from '@/lib/gemini-models'
import { sortAwardResultsByPoints } from '@/lib/award-search/sort-results'
import { getTripBuilderPromptSections } from '@/lib/booking-urls'

const IATA_RE = /^[A-Z]{3}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 64_000
const MAX_BALANCE_ROWS = 25
const MAX_SEARCH_SPAN_DAYS = 45

function validate(body: unknown): AwardSearchParams & { hotel_nights: number; destination_name: string; trip_type: 'round_trip' | 'one_way' } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const b = body as Record<string, unknown>

  const origin = typeof b.origin === 'string' ? b.origin.toUpperCase().trim() : ''
  const destination = typeof b.destination === 'string' ? b.destination.toUpperCase().trim() : ''
  if (!IATA_RE.test(origin)) return { error: 'origin must be a 3-letter IATA code' }
  if (!IATA_RE.test(destination)) return { error: 'destination must be a 3-letter IATA code' }

  const cabin = b.cabin as string
  const CABIN_VALUES = ['economy', 'premium_economy', 'business', 'first']
  if (!CABIN_VALUES.includes(cabin)) return { error: `cabin must be one of: ${CABIN_VALUES.join(', ')}` }

  const passengers = Number(b.passengers)
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return { error: 'passengers must be 1–9' }
  }

  const start_date = typeof b.start_date === 'string' ? b.start_date : ''
  const trip_type = b.trip_type === 'one_way' ? 'one_way' : 'round_trip'
  const providedReturnDate = typeof b.return_date === 'string' ? b.return_date : ''
  const end_date = trip_type === 'one_way'
    ? (providedReturnDate || start_date)
    : providedReturnDate
  if (!DATE_RE.test(start_date)) return { error: 'start_date must be YYYY-MM-DD' }
  if (!DATE_RE.test(end_date)) return { error: 'return_date must be YYYY-MM-DD' }
  if (trip_type === 'round_trip' && end_date <= start_date) return { error: 'return_date must be after start_date' }
  const startMs = Date.parse(`${start_date}T00:00:00Z`)
  const endMs = Date.parse(`${end_date}T00:00:00Z`)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { error: 'Invalid start_date or return_date' }
  }
  const spanDays = (endMs - startMs) / (24 * 60 * 60 * 1000) + 1
  if (spanDays > MAX_SEARCH_SPAN_DAYS) {
    return { error: `Date range too wide. Max ${MAX_SEARCH_SPAN_DAYS} days.` }
  }

  const hotel_nights = Number(b.hotel_nights ?? 0)
  if (!Number.isInteger(hotel_nights) || hotel_nights < 0 || hotel_nights > 14) {
    return { error: 'hotel_nights must be 0–14' }
  }

  const balances = b.balances
  if (!Array.isArray(balances) || balances.length === 0) {
    return { error: 'balances must be a non-empty array' }
  }
  if (balances.length > MAX_BALANCE_ROWS) {
    return { error: `balances can include at most ${MAX_BALANCE_ROWS} rows` }
  }
  for (const bal of balances) {
    if (!bal || typeof bal !== 'object') return { error: 'Invalid balance entry' }
    if (typeof bal.program_id !== 'string' || !UUID_RE.test(bal.program_id)) {
      return { error: 'Each balance must have a valid program_id' }
    }
    if (typeof bal.amount !== 'number' || bal.amount <= 0 || bal.amount > 100_000_000) {
      return { error: 'Each balance amount must be a positive number' }
    }
  }

  const destination_name = typeof b.destination_name === 'string' ? b.destination_name : destination

  return {
    origin, destination, cabin: cabin as AwardSearchParams['cabin'],
    passengers, start_date, end_date,
    balances: balances as AwardSearchParams['balances'],
    hotel_nights,
    destination_name,
    trip_type,
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const startedAt = Date.now()

  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) {
    logWarn('trip_builder_payload_too_large', { requestId })
    return sizeError
  }

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'trip_builder_ip',
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('trip_builder_rate_limited', { requestId })
    return rateLimitError
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const requestRegion =
    body && typeof body === 'object' && (body as Record<string, unknown>).region === 'in'
      ? 'in'
      : 'us'

  const validated = validate(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const { hotel_nights, destination_name, trip_type, ...awardParams } = validated

  try {
    const db = createServerDbClient()
    const provider = createAwardProvider()
    const results = sortAwardResultsByPoints(await provider.search(awardParams, db))

    // Build top flights from award search results
    const top_flights: TripBuilderFlightOption[] = results.slice(0, 5).map(r => ({
      program_name: r.program_name,
      estimated_miles: r.estimated_miles,
      points_needed_from_wallet: r.points_needed_from_wallet,
      transfer_chain: r.transfer_chain,
      is_reachable: r.is_reachable,
      deep_link_url: r.deep_link.url,
      deep_link_label: r.deep_link.label,
    }))

    // Build Gemini prompt
    const geminiDisabled = isGeminiDisabled()
    const apiKey = process.env.GEMINI_API_KEY
    if (geminiDisabled || !apiKey) {
      logWarn('trip_builder_ai_disabled', {
        requestId,
        reason: geminiDisabled ? 'safe_mode' : 'missing_api_key',
      })
      return NextResponse.json({
        top_flights,
        hotel: null,
        booking_steps: [],
        ai_summary: geminiDisabled
          ? 'AI planning is in safe mode. Flight options are still available below.'
          : 'AI planning unavailable — GEMINI_API_KEY not configured.',
        points_summary: '',
      } as TripBuilderResponse)
    }

    const flightSummary = results.slice(0, 6).map(r => {
      const chain = r.transfer_chain ? ` via ${r.transfer_chain}` : ' (direct)'
      const reachable = r.is_reachable ? '✓ reachable' : '✗ not reachable'
      return `- ${r.program_name}: ~${r.estimated_miles.toLocaleString()} miles (~${r.points_needed_from_wallet.toLocaleString()} points from wallet)${chain} [${reachable}]`
    }).join('\n')

    const balanceSummary = awardParams.balances.map(b =>
      `  ${b.program_id}: ${b.amount.toLocaleString()} pts`
    ).join('\n')

    const promptSections = await getTripBuilderPromptSections(requestRegion)
    const prompt = `You are an expert travel rewards advisor. Plan a trip using points/miles.

TRIP DETAILS:
- Route: ${awardParams.origin} → ${awardParams.destination} (${destination_name})
- Trip type: ${trip_type === 'one_way' ? 'One-way' : 'Round-trip'}
- Dates: ${awardParams.start_date} to ${awardParams.end_date}
- Cabin: ${awardParams.cabin}
- Passengers: ${awardParams.passengers}
- Hotel nights: ${hotel_nights}

USER'S POINT BALANCES:
${balanceSummary}

TOP AWARD FLIGHT OPTIONS FOUND:
${flightSummary}

${promptSections.hotelBookingUrls}

${promptSections.bookingStepUrls}

Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
{
  "hotel": {
    "property_name": "Specific hotel property name (e.g. Park Hyatt Tokyo)",
    "chain": "Hyatt / Marriott / Hilton / IHG / etc",
    "loyalty_program": "World of Hyatt / Marriott Bonvoy / etc",
    "approx_points_per_night": 25000,
    "transfer_suggestion": "Transfer Chase UR 1:1 to Hyatt" or null if user already has points,
    "booking_url": "exact URL from the hotel portal list above — do NOT invent property-specific paths",
    "notes": "Category 4 property, good availability"
  },
  "booking_steps": [
    { "step": 1, "action": "Transfer points", "detail": "Move 60,000 Chase UR to United MileagePlus at 1:1", "url": "exact URL from the portal list above, or null" },
    { "step": 2, "action": "Book flight", "detail": "Search United.com for saver awards on your dates", "url": "exact URL from the portal list above, or null" }
  ],
  "ai_summary": "Two sentence summary of the best overall redemption strategy for this trip.",
  "points_summary": "Use X pts from Y for flights + Z pts from W for hotel (N nights)"
}

Rules:
- Recommend a real, specific hotel property in ${destination_name} that accepts points
- For hotel.booking_url: use ONLY the exact chain portal URL from the list above — never generate a specific property path or room URL
- For booking_steps urls: use ONLY the exact portal URLs from the list above, or set url to null
- Booking steps should be numbered and actionable
- If hotel_nights is 0, set hotel to null and omit hotel from booking_steps
- If trip type is one-way, do not mention return leg or return booking steps
- Consider which programs the user actually has points in
- Keep ai_summary under 50 words`

    const genAI = new GoogleGenerativeAI(apiKey)
    const modelCandidates = await getGeminiModelCandidatesForApiKey(apiKey)
    let selectedModel: string | null = null
    let text = ''
    let lastModelErr: unknown = null

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const response = await model.generateContent(prompt)
        text = response.response.text()
        selectedModel = modelName
        break
      } catch (err) {
        markGeminiModelUnavailable(modelName, err)
        lastModelErr = err
      }
    }

    if (!selectedModel) {
      logWarn('trip_builder_ai_unavailable', {
        requestId,
        error: lastModelErr instanceof Error ? lastModelErr.message : String(lastModelErr),
      })
      return NextResponse.json({
        top_flights,
        hotel: null,
        booking_steps: [],
        ai_summary: 'AI planning unavailable right now. Flight options are still ready below.',
        points_summary: '',
      } as TripBuilderResponse)
    }

    if (selectedModel !== modelCandidates[0]) {
      logWarn('trip_builder_model_fallback_used', {
        requestId,
        selected_model: selectedModel,
      })
    }

    let aiData: {
      hotel: TripBuilderResponse['hotel']
      booking_steps: TripBuilderResponse['booking_steps']
      ai_summary: string
      points_summary: string
    } = { hotel: null, booking_steps: [], ai_summary: '', points_summary: '' }

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) aiData = JSON.parse(jsonMatch[0])
    } catch {
      console.error('[TripBuilder] Failed to parse Gemini JSON:', text)
    }

    logInfo('trip_builder_success', {
      requestId,
      provider: provider.name,
      model: selectedModel,
      flight_options: top_flights.length,
      latency_ms: Date.now() - startedAt,
    })

    return NextResponse.json({
      top_flights,
      hotel: hotel_nights > 0 ? aiData.hotel : null,
      booking_steps: aiData.booking_steps ?? [],
      ai_summary: aiData.ai_summary ?? '',
      points_summary: aiData.points_summary ?? '',
    } as TripBuilderResponse)

  } catch (err) {
    if (err instanceof AwardProviderUnavailableError) {
      logWarn('trip_builder_provider_unavailable', {
        requestId,
        error: err.message,
      })
      return NextResponse.json({ error: err.message }, { status: 503 })
    }

    logError('trip_builder_failed', {
      requestId,
      error: err instanceof Error ? err.message : 'Trip planning failed',
      latency_ms: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 },
    )
  }
}
