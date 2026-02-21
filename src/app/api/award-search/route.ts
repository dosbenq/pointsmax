// ============================================================
// POST /api/award-search
// Validates params, runs award provider, generates Gemini narrative
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createAdminClient } from '@/lib/supabase'
import { createAwardProvider } from '@/lib/award-search'
import type { AwardSearchParams, AwardSearchResult, AwardNarrative } from '@/lib/award-search'

// ── Validation helpers ────────────────────────────────────────

const IATA_RE = /^[A-Z]{3}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CABIN_VALUES = ['economy', 'premium_economy', 'business', 'first'] as const

function validateParams(body: unknown): AwardSearchParams | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const b = body as Record<string, unknown>

  const origin = typeof b.origin === 'string' ? b.origin.toUpperCase().trim() : ''
  const destination = typeof b.destination === 'string' ? b.destination.toUpperCase().trim() : ''
  if (!IATA_RE.test(origin)) return { error: 'origin must be a 3-letter IATA airport code' }
  if (!IATA_RE.test(destination)) return { error: 'destination must be a 3-letter IATA airport code' }

  const cabin = b.cabin as string
  if (!CABIN_VALUES.includes(cabin as typeof CABIN_VALUES[number])) {
    return { error: `cabin must be one of: ${CABIN_VALUES.join(', ')}` }
  }

  const passengers = Number(b.passengers)
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    return { error: 'passengers must be an integer between 1 and 9' }
  }

  const start_date = typeof b.start_date === 'string' ? b.start_date : ''
  const end_date = typeof b.end_date === 'string' ? b.end_date : ''
  if (!DATE_RE.test(start_date)) return { error: 'start_date must be YYYY-MM-DD' }
  if (!DATE_RE.test(end_date)) return { error: 'end_date must be YYYY-MM-DD' }
  if (end_date < start_date) return { error: 'end_date must be on or after start_date' }

  const balances = b.balances
  if (!Array.isArray(balances) || balances.length === 0) {
    return { error: 'balances must be a non-empty array' }
  }
  for (const bal of balances) {
    if (!bal || typeof bal !== 'object') return { error: 'Invalid balance entry' }
    if (typeof bal.program_id !== 'string' || !bal.program_id) {
      return { error: 'Each balance must have a program_id' }
    }
    if (typeof bal.amount !== 'number' || bal.amount <= 0) {
      return { error: 'Each balance amount must be a positive number' }
    }
  }

  return {
    origin,
    destination,
    cabin: cabin as AwardSearchParams['cabin'],
    passengers,
    start_date,
    end_date,
    balances: balances as AwardSearchParams['balances'],
  }
}

// ── Gemini narrative ──────────────────────────────────────────

async function generateNarrative(
  params: AwardSearchParams,
  results: AwardSearchResult[],
): Promise<AwardNarrative | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const top = results.slice(0, 6)
    const resultsSummary = top.map(r => {
      const reachable = r.is_reachable ? 'REACHABLE' : 'NOT REACHABLE'
      const avail = r.has_real_availability ? '(live availability)' : '(estimate)'
      const chain = r.transfer_chain ? ` via ${r.transfer_chain}` : ' (direct)'
      const dollarVal = (r.estimated_cash_value_cents / 100).toLocaleString('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const response = await model.generateContent(prompt)
    const text = response.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0]) as AwardNarrative
  } catch (err) {
    console.error('[AwardSearch] Narrative generation failed:', err)
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validated = validateParams(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const params = validated

  try {
    const client = createAdminClient()
    const provider = createAwardProvider()

    const results = await provider.search(params, client)

    // Generate AI narrative (non-blocking — failure returns null)
    const ai_narrative = await generateNarrative(params, results)

    return NextResponse.json({
      provider: provider.name,
      params,
      results,
      ai_narrative,
      searched_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[AwardSearch] Search failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 },
    )
  }
}
