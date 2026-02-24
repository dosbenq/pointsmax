import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import { NextRequest } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getRequestId, logError, logInfo, logWarn } from '@/lib/logger'
import { getGeminiModelCandidatesForApiKey, isGeminiDisabled, markGeminiModelUnavailable } from '@/lib/gemini-models'

// Known booking URLs — AI picks from these so it can't hallucinate links
const BOOKING_URLS = `
Known booking URLs (only use these exact URLs in links):
- Chase UR transfer partners: https://www.ultimaterewards.com
- Amex MR transfer partners: https://global.americanexpress.com/rewards/transfer
- Capital One transfer partners: https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/
- Citi ThankYou transfer partners: https://www.citi.com/credit-cards/thankyou-rewards
- Bilt transfer partners: https://www.bilt.com/rewards/travel
- Hyatt award search: https://world.hyatt.com/content/gp/en/rewards/free-nights-upgrades.html
- Marriott Bonvoy award search: https://www.marriott.com/loyalty/redeem.mi
- Hilton Honors award search: https://www.hilton.com/en/hilton-honors/points/
- IHG One Rewards award search: https://www.ihg.com/onerewards/content/us/en/redeem-rewards
- United MileagePlus award search: https://www.united.com/en/us/fly/travel/awards.html
- Delta SkyMiles award search: https://www.delta.com/us/en/skymiles/overview
- American AAdvantage award search: https://www.aa.com/homePage.do
- Air France/KLM Flying Blue: https://www.flyingblue.com/en/spend/flights
- British Airways Avios: https://www.britishairways.com/travel/home/public/en_us/
- Air Canada Aeroplan: https://www.aircanada.com/ca/en/aco/home/aeroplan.html
- Singapore KrisFlyer: https://www.singaporeair.com/en_UK/us/home
- Turkish Miles&Smiles: https://www.turkishairlines.com/en-int/miles-and-smiles/
- Avianca LifeMiles: https://www.lifemiles.com/fly/search
`.trim()

type Balance = { name: string; amount: number }
type TopResult = {
  category?: string
  label: string
  from_program?: { name?: string }
  to_program?: { name?: string } | null
  total_value_cents: number
  cpp_cents: number
  active_bonus_pct?: number
}

type AiSafeModeResponse = {
  type: 'recommendation'
  headline: string
  reasoning: string
  flight: null
  hotel: null
  total_summary: string
  steps: string[]
  tip: string
  links: Array<{ label: string; url: string }>
}


const MAX_BODY_BYTES = 64_000
const MAX_MESSAGE_CHARS = 2_000
const MAX_HISTORY_ITEMS = 24

function getSafeAppUrl(): string {
  const fallback = 'https://pointsmax.com'
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? fallback
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback
    return parsed.origin
  } catch {
    return fallback
  }
}

function buildSafeModeResponse(topResults: TopResult[]): AiSafeModeResponse {
  const best = topResults[0]
  const bestValue = best
    ? (best.total_value_cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
    : null

  const headline = best
    ? `Start with ${best.label}`
    : 'Start with your top redemption option'
  const reasoning = best
    ? `AI is currently in safe mode, so this recommendation uses your pre-calculated results. Your current top option is ${best.label} at ${best.cpp_cents.toFixed(2)} cents per point (about ${bestValue}).`
    : 'AI is currently in safe mode, so this recommendation uses your pre-calculated results only.'

  return {
    type: 'recommendation',
    headline,
    reasoning,
    flight: null,
    hotel: null,
    total_summary: best
      ? `Prioritize ${best.label} as your first booking path.`
      : 'Review your top redemption rows and pick the highest-value option.',
    steps: [
      'Open your calculator results and confirm the top-ranked option.',
      'Verify live award availability before transferring points.',
      'Transfer only after confirming exact flight/hotel availability.',
      'Book immediately after transfer to reduce availability risk.',
    ],
    tip: 'Never transfer points speculatively. Confirm availability first.',
    links: [{ label: 'Open calculator', url: `${getSafeAppUrl()}/calculator` }],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function toBalances(value: unknown): Balance[] {
  if (!Array.isArray(value)) return []
  const rows: Balance[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    const amount = typeof entry.amount === 'number' && Number.isFinite(entry.amount)
      ? entry.amount
      : NaN
    if (!name || !Number.isFinite(amount) || amount < 0) continue
    rows.push({ name, amount })
  }
  return rows.slice(0, 25)
}

function toTopResults(value: unknown): TopResult[] {
  if (!Array.isArray(value)) return []
  const rows: TopResult[] = []

  for (const entry of value) {
    if (!isRecord(entry)) continue
    const label = typeof entry.label === 'string' ? entry.label.trim() : ''
    const totalValueCents =
      typeof entry.total_value_cents === 'number' && Number.isFinite(entry.total_value_cents)
        ? entry.total_value_cents
        : NaN
    const cppCents =
      typeof entry.cpp_cents === 'number' && Number.isFinite(entry.cpp_cents)
        ? entry.cpp_cents
        : NaN

    if (!label || !Number.isFinite(totalValueCents) || !Number.isFinite(cppCents)) continue

    const category = typeof entry.category === 'string' ? entry.category : undefined
    const from_program = isRecord(entry.from_program)
      ? { name: typeof entry.from_program.name === 'string' ? entry.from_program.name : undefined }
      : undefined
    const to_program = isRecord(entry.to_program)
      ? { name: typeof entry.to_program.name === 'string' ? entry.to_program.name : undefined }
      : null
    const active_bonus_pct =
      typeof entry.active_bonus_pct === 'number' && Number.isFinite(entry.active_bonus_pct)
        ? entry.active_bonus_pct
        : undefined

    rows.push({
      category,
      label,
      from_program,
      to_program,
      total_value_cents: totalValueCents,
      cpp_cents: cppCents,
      active_bonus_pct,
    })
  }

  return rows
}

// POST /api/ai/recommend
// Body: { history: GeminiContent[], message: string, balances, topResults?, preferences? }
// Streams back a JSON string the client accumulates then parses
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const startedAt = Date.now()

  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) {
    logWarn('ai_recommend_payload_too_large', { requestId })
    return sizeError
  }

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'ai_recommend_ip',
    maxRequests: 30,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) {
    logWarn('ai_recommend_rate_limited', { requestId })
    return rateLimitError
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!isRecord(payload)) return new Response('Invalid payload', { status: 400 })

  const message = typeof payload.message === 'string' ? payload.message : ''
  if (!message.trim()) return new Response('Message is required', { status: 400 })
  if (message.length > MAX_MESSAGE_CHARS) {
    return new Response(`message too long (max ${MAX_MESSAGE_CHARS} chars)`, { status: 400 })
  }

  const balances = toBalances(payload.balances)
  const topResults = toTopResults(payload.topResults)
  if (balances.length === 0) {
    return new Response('balances must include at least one valid entry', { status: 400 })
  }

  const history = Array.isArray(payload.history) ? payload.history : []
  if (history.length > MAX_HISTORY_ITEMS) {
    return new Response(`history too long (max ${MAX_HISTORY_ITEMS} entries)`, { status: 400 })
  }
  const preferences = isRecord(payload.preferences) ? payload.preferences : null

  const apiKey = process.env.GEMINI_API_KEY
  const geminiDisabled = isGeminiDisabled()

  if (geminiDisabled || !apiKey) {
    if (!apiKey && !geminiDisabled) {
      logError('ai_recommend_missing_env', { requestId, env: 'GEMINI_API_KEY' })
    }
    logWarn('ai_recommend_safe_mode', {
      requestId,
      reason: geminiDisabled ? 'gemini_disabled' : 'missing_api_key',
      latency_ms: Date.now() - startedAt,
    })
    return new Response(JSON.stringify(buildSafeModeResponse(topResults)), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // ── Build context (re-injected every turn via system prompt) ───
  const balanceSummary = balances
    .map((b) => `  - ${b.name}: ${b.amount.toLocaleString()} points`)
    .join('\n')

  const partnersByProgram: Record<string, string[]> = {}
  for (const r of topResults) {
    if (r.category !== 'transfer_partner') continue
    const prog = r.from_program?.name ?? ''
    const partner = r.to_program?.name ?? ''
    if (!prog) continue
    if (!partnersByProgram[prog]) partnersByProgram[prog] = []
    if (partner && !partnersByProgram[prog].includes(partner)) {
      partnersByProgram[prog].push(partner)
    }
  }

  const partnerSummary = Object.entries(partnersByProgram)
    .map(([prog, partners]) => `  - ${prog} → ${partners.join(', ')}`)
    .join('\n') || '  (none)'

  const topValueSummary = topResults.length > 0
    ? topResults
      .slice(0, 8)
      .map((r) => {
        const dollars = (r.total_value_cents / 100).toLocaleString('en-US', {
          style: 'currency', currency: 'USD', maximumFractionDigits: 0,
        })
        const bonus = r.active_bonus_pct ? ` ⚡+${r.active_bonus_pct}% bonus` : ''
        return `  - ${r.label}: ${dollars} (${r.cpp_cents.toFixed(2)}¢/pt)${bonus}`
      })
      .join('\n')
    : '  (No pre-calculated redemption rows were provided for this chat turn.)'

  // ── User preferences context ────────────────────────────────────
  const todayDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  let preferencesContext = ''
  if (preferences) {
    const parts: string[] = []
    if (typeof preferences.home_airport === 'string' && preferences.home_airport) {
      parts.push(`User's home airport: ${preferences.home_airport}`)
    }
    if (
      typeof preferences.preferred_cabin === 'string' &&
      preferences.preferred_cabin &&
      preferences.preferred_cabin !== 'any'
    ) {
      parts.push(`Preferred cabin class: ${preferences.preferred_cabin}`)
    }
    if (Array.isArray(preferences.avoided_airlines) && preferences.avoided_airlines.length > 0) {
      parts.push(`Airlines to avoid: ${preferences.avoided_airlines.join(', ')}`)
    }
    if (Array.isArray(preferences.preferred_airlines) && preferences.preferred_airlines.length > 0) {
      parts.push(`Preferred airlines: ${preferences.preferred_airlines.join(', ')}`)
    }
    if (parts.length > 0) {
      preferencesContext = `\nUSER PREFERENCES:\n${parts.map(p => `  - ${p}`).join('\n')}\n`
    }
  }

  // ── System prompt ───────────────────────────────────────────────
  const systemPrompt = `You are a friendly, expert travel rewards advisor. You have a natural conversation with the user to understand their trip, then give a specific, actionable recommendation.

Today's date: ${todayDate}${preferencesContext}

USER'S POINTS BALANCES:
${balanceSummary}

TRANSFER PARTNERS AVAILABLE (only recommend programs from this list):
${partnerSummary}

PRE-CALCULATED REDEMPTION VALUES:
${topValueSummary}

${BOOKING_URLS}

CONVERSATION RULES:
1. If the user's first message is vague (no destination, dates, travelers, or cabin class), ask 2-3 friendly clarifying questions. Keep the message short and warm.
2. Once you have enough info (destination + at least one of: dates/flexibility, travelers, cabin preference), give the full recommendation.
3. If the user asks a follow-up question after a recommendation, answer it conversationally and update the recommendation if needed.
4. Always reference the user's actual balances and any calculated dollar values provided.
5. Only recommend transfer partners the user has access to.

RESPONSE FORMAT — return ONLY valid JSON (no markdown, no code fences):

When clarifying:
{
  "type": "clarifying",
  "message": "Warm 1-2 sentence acknowledgment of their goal",
  "questions": ["Question 1?", "Question 2?", "Question 3?"]
}

When recommending:
{
  "type": "recommendation",
  "headline": "Specific one-line recommendation under 12 words",
  "reasoning": "2-3 sentences with specific programs, sweet spots, and dollar values",
  "flight": {
    "airline": "Specific airline",
    "cabin": "Economy | Business | First",
    "route": "e.g. JFK-NRT",
    "points_needed": "e.g. 75,000 miles one-way",
    "transfer_chain": "e.g. Chase UR → United MileagePlus (1:1)",
    "notes": "Booking tip or sweet spot detail"
  },
  "hotel": {
    "name": "Specific property (e.g. Park Hyatt Tokyo)",
    "chain": "Loyalty program name",
    "points_per_night": "e.g. 25,000 pts/night",
    "transfer_chain": "e.g. Chase UR → World of Hyatt (1:1)",
    "notes": "Category, peak/off-peak, or availability note"
  },
  "total_summary": "e.g. ~100,000 Chase UR for 2 nights + business class roundtrip",
  "steps": ["Step 1 with specific platform/URL", "Step 2", "Step 3", "Step 4"],
  "tip": "Insider tip about award space, booking windows, or hidden value",
  "links": [
    { "label": "Button label (max 4 words)", "url": "exact URL from the list above" }
  ]
}
Set flight or hotel to null if not relevant. Include 2-4 links.`

  // ── Multi-turn chat ─────────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(apiKey)
  const modelCandidates = await getGeminiModelCandidatesForApiKey(apiKey)

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        let lastErr: unknown = null

        for (let i = 0; i < modelCandidates.length; i++) {
          const modelName = modelCandidates[i]
          let streamedAnyChunk = false

          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              systemInstruction: systemPrompt,
            })
            const chat = model.startChat({
              history: history as Content[],
            })

            logInfo('ai_recommend_stream_start', { requestId, model: modelName })
            const result = await chat.sendMessageStream(message)
            for await (const chunk of result.stream) {
              const text = chunk.text()
              if (!text) continue
              streamedAnyChunk = true
              controller.enqueue(encoder.encode(text))
            }

            if (i > 0) {
              logWarn('ai_recommend_model_fallback_used', {
                requestId,
                selected_model: modelName,
              })
            }

            logInfo('ai_recommend_stream_complete', {
              requestId,
              model: modelName,
              latency_ms: Date.now() - startedAt,
            })
            controller.close()
            return
          } catch (err) {
            markGeminiModelUnavailable(modelName, err)
            lastErr = err
            if (streamedAnyChunk) break
          }
        }

        throw lastErr instanceof Error ? lastErr : new Error('All Gemini model candidates failed')
      } catch (err) {
        logError('ai_recommend_stream_error', {
          requestId,
          error: err instanceof Error ? err.message : String(err),
          latency_ms: Date.now() - startedAt,
        })
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: 'AI assistant is temporarily unavailable. Please try again in a moment.' }))
        )
        controller.close()
        return
      } finally {
        // no-op: controller closed on success/failure paths above
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
