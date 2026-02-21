import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import { NextRequest } from 'next/server'

// Known booking URLs — AI picks from these so it can't hallucinate links
const BOOKING_URLS = `
Known booking URLs (only use these exact URLs in links):
- Chase UR transfers: https://ultimaterewards.com
- Amex MR transfers: https://americanexpress.com/en-us/rewards/membership-rewards/use-points/travel.html
- Capital One transfers: https://capitalone.com/learn-grow/money-management/miles-transfer-partners/
- Citi TY transfers: https://citi.com/credit-cards/thankyou-rewards
- Bilt transfers: https://biltrewards.com/points/transfer
- Hyatt award search: https://hyatt.com/en-US/rewards/use-points/book-with-points
- Marriott award search: https://marriott.com/rewards/redeem/
- Hilton award search: https://hilton.com/en/hilton-honors/redeem/
- IHG award search: https://ihg.com/rewardsclub/us/en/redeem
- United award search: https://united.com/en/us/fly/travel/awards.html
- Delta award search: https://delta.com/us/en/skymiles/overview
- American Airlines awards: https://aa.com/i18n/aadvantage-program/miles/redeem/award-travel.jsp
- Air France Flying Blue: https://airfrance.us/en/flyingblue
- British Airways Avios: https://britishairways.com/en-us/executive-club/spending-avios/travel
- Air Canada Aeroplan: https://aircanada.com/us/en/aco/home/aeroplan/use-your-points.html
- Singapore KrisFlyer: https://singaporeair.com/krisflyer/pages/overview.jsp
- Turkish Miles&Smiles: https://turkishairlines.com/en-int/miles-smiles/
- Avianca LifeMiles: https://lifemiles.com
`.trim()

// POST /api/ai/recommend
// Body: { history: GeminiContent[], message: string, balances, topResults, preferences? }
// Streams back a JSON string the client accumulates then parses
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return new Response('GEMINI_API_KEY not configured', { status: 500 })

  const { history, message, balances, topResults, preferences } = await req.json()
  if (!message?.trim()) return new Response('Message is required', { status: 400 })

  // ── Build context (re-injected every turn via system prompt) ───
  const balanceSummary = balances
    .map((b: { name: string; amount: number }) =>
      `  - ${b.name}: ${b.amount.toLocaleString()} points`
    )
    .join('\n')

  const partnersByProgram: Record<string, string[]> = {}
  for (const r of topResults) {
    if (r.category !== 'transfer_partner') continue
    const prog: string = r.from_program.name
    const partner: string = r.to_program?.name ?? ''
    if (!partnersByProgram[prog]) partnersByProgram[prog] = []
    if (partner && !partnersByProgram[prog].includes(partner))
      partnersByProgram[prog].push(partner)
  }
  const partnerSummary = Object.entries(partnersByProgram)
    .map(([prog, partners]) => `  - ${prog} → ${partners.join(', ')}`)
    .join('\n') || '  (none)'

  const topValueSummary = topResults
    .slice(0, 8)
    .map((r: { label: string; total_value_cents: number; cpp_cents: number; active_bonus_pct?: number }) => {
      const dollars = (r.total_value_cents / 100).toLocaleString('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
      })
      const bonus = r.active_bonus_pct ? ` ⚡+${r.active_bonus_pct}% bonus` : ''
      return `  - ${r.label}: ${dollars} (${r.cpp_cents.toFixed(2)}¢/pt)${bonus}`
    })
    .join('\n')

  // ── User preferences context ────────────────────────────────────
  const todayDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  let preferencesContext = ''
  if (preferences) {
    const parts: string[] = []
    if (preferences.home_airport) parts.push(`User's home airport: ${preferences.home_airport}`)
    if (preferences.preferred_cabin && preferences.preferred_cabin !== 'any') parts.push(`Preferred cabin class: ${preferences.preferred_cabin}`)
    if (preferences.avoided_airlines?.length > 0) parts.push(`Airlines to avoid: ${preferences.avoided_airlines.join(', ')}`)
    if (preferences.preferred_airlines?.length > 0) parts.push(`Preferred airlines: ${preferences.preferred_airlines.join(', ')}`)
    if (parts.length > 0) preferencesContext = `\nUSER PREFERENCES:\n${parts.map(p => `  - ${p}`).join('\n')}\n`
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
4. Always reference the user's actual balances and calculated dollar values.
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
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  })

  const chat = model.startChat({
    history: (history ?? []) as Content[],
  })

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        console.log('[AI] Sending to Gemini chat...')
        const result = await chat.sendMessageStream(message)
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) controller.enqueue(encoder.encode(text))
        }
        console.log('[AI] Stream complete')
      } catch (err) {
        console.error('[AI] Error:', err)
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
