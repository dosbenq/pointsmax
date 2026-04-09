import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import { NextRequest } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { createServerDbClient } from '@/lib/supabase'
import { getRequestId, logError, logWarn } from '@/lib/logger'
import { getGeminiModelCandidatesForApiKey, isGeminiDisabled, markGeminiModelUnavailable } from '@/lib/gemini-models'
import { type Region } from '@/lib/regions'
import { getBookingUrlsForPrompt } from '@/lib/booking-urls'
import { getSafeAppOrigin } from '@/lib/app-origin'
import { logAiMetric } from '@/lib/telemetry'
import {
  generateAiCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
  logAiCacheMetric,
} from '@/lib/ai-cache'
import {
  geminiCircuitBreaker,
  CircuitBreakerOpenError,
  withTimeout,
  getAiInferenceTimeoutMs,
} from '@/lib/circuit-breaker'

type Balance = { name: string; amount: number; program_id?: string }
type TopResult = {
  category?: string
  label: string
  from_program?: { id?: string; name?: string; slug?: string }
  to_program?: { id?: string; name?: string; slug?: string } | null
  total_value_cents: number
  cpp_cents: number
  active_bonus_pct?: number
}

type RegionCode = 'us' | 'in'

type RegionContext = {
  code: RegionCode
  currency: 'USD' | 'INR'
  currencySymbol: '$' | '₹'
  cppUnitLabel: string
  displayName: string
}

type ProgramContextRow = {
  id: string
  name: string
  slug: string
  cpp_cents: number | null
}

const REGION_CONTEXT: Record<RegionCode, RegionContext> = {
  us: {
    code: 'us',
    currency: 'USD',
    currencySymbol: '$',
    cppUnitLabel: '¢/pt',
    displayName: 'United States',
  },
  in: {
    code: 'in',
    currency: 'INR',
    currencySymbol: '₹',
    cppUnitLabel: 'paise/pt',
    displayName: 'India',
  },
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
  metadata: {
    freshness: string
    source: string
    confidence: 'medium'
  }
}


const MAX_BODY_BYTES = 64_000
const MAX_MESSAGE_CHARS = 2_000
const MAX_HISTORY_ITEMS = 24
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes for recommendations

function normalizeRegion(value: unknown): RegionCode {
  return value === 'in' ? 'in' : 'us'
}

/** Strip control characters and limit length for prompt-safe interpolation */
function sanitizeForPrompt(input: string, maxLen = 200): string {
  return input
    .replace(/[\x00-\x1f\x7f]/g, '') // Strip control characters
    .replace(/\n/g, ' ')              // Replace newlines with spaces
    .replace(/[<>]/g, '')             // Strip angle brackets
    .slice(0, maxLen)
    .trim()
}

function formatMinorCurrency(valueCents: number, regionCtx: RegionContext): string {
  return (valueCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: regionCtx.currency,
    maximumFractionDigits: 0,
  })
}

function formatCpp(cppCents: number, regionCtx: RegionContext): string {
  if (regionCtx.code === 'in') {
    return `${Math.round(cppCents)} paise/pt`
  }
  return `${cppCents.toFixed(2)}¢/pt`
}

async function fetchProgramContext(
  balances: Balance[],
  topResults: TopResult[],
  regionCtx: RegionContext,
): Promise<ProgramContextRow[]> {
  const db = createServerDbClient()
  const regionGeo = regionCtx.code.toUpperCase()

  const [{ data: programsData, error: programsError }, { data: valuationData, error: valuationError }] = await Promise.all([
    db
      .from('programs')
      .select('id, name, slug, geography')
      .eq('is_active', true)
      .in('geography', ['global', regionGeo]),
    db
      .from('latest_valuations')
      .select('program_id, cpp_cents'),
  ])

  if (programsError || valuationError) return []

  const valuations = new Map<string, number>(
    (valuationData ?? [])
      .map((row) => {
        const programId = typeof row.program_id === 'string' ? row.program_id : ''
        const cpp = typeof row.cpp_cents === 'number' && Number.isFinite(row.cpp_cents) ? row.cpp_cents : NaN
        if (!programId || !Number.isFinite(cpp)) return null
        return [programId, cpp] as const
      })
      .filter((row): row is readonly [string, number] => row !== null),
  )

  const programs = (programsData ?? [])
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id : '',
      name: typeof row.name === 'string' ? row.name : '',
      slug: typeof row.slug === 'string' ? row.slug : '',
    }))
    .filter((row) => row.id && row.name && row.slug)

  const programsById = new Map(programs.map((p) => [p.id, p]))
  const programsByName = new Map(programs.map((p) => [p.name.toLowerCase(), p]))
  const programsBySlug = new Map(programs.map((p) => [p.slug.toLowerCase(), p]))

  const selected = new Map<string, ProgramContextRow>()
  const attach = (programId: string) => {
    const p = programsById.get(programId)
    if (!p || selected.has(p.id)) return
    selected.set(p.id, {
      id: p.id,
      name: p.name,
      slug: p.slug,
      cpp_cents: valuations.get(p.id) ?? null,
    })
  }

  for (const b of balances) {
    if (b.program_id) {
      attach(b.program_id)
      continue
    }
    const p = programsByName.get(b.name.toLowerCase())
    if (p) attach(p.id)
  }

  for (const row of topResults) {
    const fromId = row.from_program?.id
    const toId = row.to_program?.id
    if (fromId) attach(fromId)
    if (toId) attach(toId)
    const fromSlug = row.from_program?.slug?.toLowerCase()
    const toSlug = row.to_program?.slug?.toLowerCase()
    if (fromSlug) {
      const p = programsBySlug.get(fromSlug)
      if (p) attach(p.id)
    }
    if (toSlug) {
      const p = programsBySlug.get(toSlug)
      if (p) attach(p.id)
    }
  }

  return [...selected.values()]
}

async function fetchTransferPartnerSummary(
  balances: Balance[],
): Promise<string> {
  const balanceProgramIds = [...new Set(
    balances
      .map((balance) => balance.program_id)
      .filter((programId): programId is string => typeof programId === 'string' && programId.length > 0),
  )]

  if (balanceProgramIds.length === 0) return '  (none)'

  const db = createServerDbClient()
  const { data: partnersData, error: partnersError } = await db
    .from('transfer_partners')
    .select('from_program_id, to_program_id')
    .eq('is_active', true)
    .in('from_program_id', balanceProgramIds)

  if (partnersError || !partnersData || partnersData.length === 0) return '  (none)'

  const partnerRows = partnersData as Array<{ from_program_id: string; to_program_id: string }>
  const programIds = [...new Set(partnerRows.flatMap((row) => [row.from_program_id, row.to_program_id]))]
  const { data: programsData, error: programsError } = await db
    .from('programs')
    .select('id, name')
    .in('id', programIds)

  if (programsError || !programsData) return '  (none)'

  const programNameById = new Map(
    (programsData as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]),
  )
  const partnersByProgram = new Map<string, string[]>()

  for (const row of partnerRows) {
    const fromName = programNameById.get(row.from_program_id)
    const toName = programNameById.get(row.to_program_id)
    if (!fromName || !toName) continue
    const list = partnersByProgram.get(fromName) ?? []
    if (!list.includes(toName)) {
      list.push(toName)
      partnersByProgram.set(fromName, list)
    }
  }

  if (partnersByProgram.size === 0) return '  (none)'

  return [...partnersByProgram.entries()]
    .map(([program, partnerNames]) => `  - ${program} → ${partnerNames.join(', ')}`)
    .join('\n')
}

function buildSafeModeResponse(
  topResults: TopResult[],
  regionCtx: RegionContext,
  appOrigin: string,
): AiSafeModeResponse {
  const best = topResults[0]
  const bestValue = best
    ? formatMinorCurrency(best.total_value_cents, regionCtx)
    : null

  const headline = best
    ? `Start with ${best.label}`
    : 'Explore your top redemption options'

  const reasoning = best
    ? `AI is currently in safe mode, so this recommendation uses your pre-calculated results. Your current top option is ${best.label} at ${formatCpp(best.cpp_cents, regionCtx)} (about ${bestValue}).`
    : 'Our AI is currently in safe mode. Based on your balances, you can find high-value redemptions by running the calculator for a specific destination.'

  return {
    type: 'recommendation',
    headline,
    reasoning,
    flight: null,
    hotel: null,
    total_summary: best
      ? `Prioritize ${best.label} as your first booking path.`
      : 'Use the calculator to find the best use for your points.',
    steps: best
      ? [
        'Open your calculator results and confirm the top-ranked option.',
        'Verify live award availability before transferring points.',
        'Transfer only after confirming exact flight/hotel availability.',
        'Book immediately after transfer to reduce availability risk.',
      ]
      : [
        'Enter a destination in the calculator to see specific flight and hotel options.',
        'Review the value of your points across different transfer partners.',
        'Check for active transfer bonuses that could increase your points value.',
        'Ask the AI advisor again once you have a specific goal in mind.',
      ],
    tip: 'Never transfer points speculatively. Confirm availability first.',
    links: [{ label: 'Open calculator', url: `${appOrigin}/${regionCtx.code}/calculator` }],
    metadata: {
      freshness: new Date().toISOString(),
      source: 'PointsMax Safe Mode (Deterministic Fallback)',
      confidence: 'medium',
    },
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
    const program_id = typeof entry.program_id === 'string' ? entry.program_id : undefined
    if (!name || !Number.isFinite(amount) || amount < 0) continue
    rows.push({ name, amount, program_id })
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
      ? {
        id: typeof entry.from_program.id === 'string' ? entry.from_program.id : undefined,
        name: typeof entry.from_program.name === 'string' ? entry.from_program.name : undefined,
        slug: typeof entry.from_program.slug === 'string' ? entry.from_program.slug : undefined,
      }
      : undefined
    const to_program = isRecord(entry.to_program)
      ? {
        id: typeof entry.to_program.id === 'string' ? entry.to_program.id : undefined,
        name: typeof entry.to_program.name === 'string' ? entry.to_program.name : undefined,
        slug: typeof entry.to_program.slug === 'string' ? entry.to_program.slug : undefined,
      }
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
  const appOrigin = getSafeAppOrigin(req.nextUrl.origin)
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
    return new Response('Invalid JSON', {
      status: 400,
      headers: {
        'X-PointsMax-Cache': 'MISS',
        'X-AI-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }

  if (!isRecord(payload)) {
    return new Response('Invalid payload', {
      status: 400,
      headers: {
        'X-PointsMax-Cache': 'MISS',
        'X-AI-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }

  const message = typeof payload.message === 'string' ? payload.message : ''
  if (!message.trim()) {
    return new Response('Message is required', {
      status: 400,
      headers: {
        'X-PointsMax-Cache': 'MISS',
        'X-AI-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return new Response(`message too long (max ${MAX_MESSAGE_CHARS} chars)`, {
      status: 400,
      headers: {
        'X-PointsMax-Cache': 'MISS',
        'X-AI-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }

  const region: Region = normalizeRegion(payload.region)
  const regionCtx = REGION_CONTEXT[region]
  const isIndia = region === 'in'
  const balances = toBalances(payload.balances)
  const topResults = toTopResults(payload.topResults)
  // K3: Return helpful message for empty balances instead of error
  if (balances.length === 0) {
    return new Response(JSON.stringify({
      type: 'clarifying',
      message: 'Add your point balances above to get personalized advice.',
      questions: ['Enter your points balance and select a program, then ask me for recommendations!'],
    }), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-PointsMax-Cache': 'MISS',
        'X-AI-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }

  const history = Array.isArray(payload.history) ? payload.history : []
  if (history.length > MAX_HISTORY_ITEMS) {
    return new Response(`history too long (max ${MAX_HISTORY_ITEMS} entries)`, {
      status: 400,
      headers: {
        'X-PointsMax-Cache': 'MISS',
        'X-AI-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }
  const preferences = isRecord(payload.preferences) ? payload.preferences : null

  // ── Cache Layer ──────────────────────────────────────────────────
  const cacheKey = generateAiCacheKey('recommend', {
    message,
    balances,
    topResults,
    preferences,
    region,
    historyHash: history?.length ? JSON.stringify(history).length + '-' + history.length : '0',
  })

  const cached = getCachedAiResponse<string>(cacheKey)
  if (cached) {
    logAiCacheMetric('hit', 'recommend', requestId)
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(cached))
          controller.close()
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-PointsMax-Cache': 'HIT',
          'X-AI-Latency-Ms': String(Date.now() - startedAt),
        },
      },
    )
  }
  logAiCacheMetric('miss', 'recommend', requestId)

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
    return new Response(JSON.stringify(buildSafeModeResponse(topResults, regionCtx, appOrigin)), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-PointsMax-Cache': 'MISS',
        'X-AI-Latency-Ms': String(Date.now() - startedAt),
      },
    })
  }

  const [programContext, fallbackPartnerSummary] = await Promise.all([
    fetchProgramContext(balances, topResults, regionCtx),
    fetchTransferPartnerSummary(balances),
  ])

  // ── Build context (re-injected every turn via system prompt) ───
  const programContextById = new Map(programContext.map((p) => [p.id, p]))
  const balanceSummary = balances
    .map((b) => {
      if (!b.program_id) {
        return `  - ${sanitizeForPrompt(b.name)}: ${b.amount.toLocaleString()} points`
      }
      const ctx = programContextById.get(b.program_id)
      if (!ctx) {
        return `  - ${sanitizeForPrompt(b.name)}: ${b.amount.toLocaleString()} points`
      }
      const cpp = typeof ctx.cpp_cents === 'number' ? ` · ${formatCpp(ctx.cpp_cents, regionCtx)}` : ''
      return `  - ${sanitizeForPrompt(ctx.name)} (${sanitizeForPrompt(ctx.slug)}): ${b.amount.toLocaleString()} points${cpp}`
    })
    .join('\n')

  const partnersByProgram: Record<string, string[]> = {}
  for (const r of topResults) {
    if (r.category !== 'transfer_partner') continue
    const prog = sanitizeForPrompt(r.from_program?.name ?? '')
    const partner = sanitizeForPrompt(r.to_program?.name ?? '')
    if (!prog) continue
    if (!partnersByProgram[prog]) partnersByProgram[prog] = []
    if (partner && !partnersByProgram[prog].includes(partner)) {
      partnersByProgram[prog].push(partner)
    }
  }

  const partnerSummary = Object.entries(partnersByProgram)
    .map(([prog, partners]) => `  - ${prog} → ${partners.join(', ')}`)
    .join('\n') || fallbackPartnerSummary

  const topValueSummary = topResults.length > 0
    ? topResults
      .slice(0, 8)
      .map((r) => {
        const displayValue = formatMinorCurrency(r.total_value_cents, regionCtx)
        const bonus = r.active_bonus_pct ? ` ⚡+${r.active_bonus_pct}% bonus` : ''
        return `  - ${sanitizeForPrompt(r.label)}: ${displayValue} (${formatCpp(r.cpp_cents, regionCtx)})${bonus}`
      })
      .join('\n')
    : '  (No pre-calculated redemption rows were provided for this chat turn.)'

  const programCppSummary = programContext.length > 0
    ? programContext
      .map((p) => {
        if (typeof p.cpp_cents !== 'number') {
          return `  - ${p.name} (${p.slug}): valuation unavailable`
        }
        return `  - ${p.name} (${p.slug}): ${formatCpp(p.cpp_cents, regionCtx)}`
      })
      .join('\n')
    : '  (No program valuation context found for this wallet.)'

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
  // Region-aware currency terms
  const currencyUnit = isIndia ? 'rupees (₹)' : 'dollars ($)'
  const cppUnit = isIndia ? 'paise per point (100 paise = ₹1)' : 'cents per point (100 cents = $1)'
  
  const systemPrompt = `You are a friendly, expert travel rewards advisor. You have a natural conversation with the user to understand their trip, then give a specific, actionable recommendation.

Today's date: ${todayDate}${preferencesContext}

CURRENT POINT VALUATIONS (TPG April 2026, refreshed daily from our database):
  - Chase UR: 2.05 cents per point
  - Amex MR: 2.00 cents per point
  - Bilt Rewards: 2.20 cents per point (highest value transferable currency)
  - Capital One Miles: 1.85 cents per point
  - Citi ThankYou: 1.90 cents per point
  - United MileagePlus: 1.35 cents per mile
  - Delta SkyMiles: 1.20 cents per mile
  - American AAdvantage: 1.60 cents per mile
  - Southwest Rapid Rewards: 1.25 cents per point
  - World of Hyatt: 1.70 cents per point
  - Marriott Bonvoy: 0.75 cents per point
  - Hilton Honors: 0.40 cents per point
Use these valuations when advising the user. Always cite the source as "TPG April 2026".

USER'S POINTS BALANCES:
${balanceSummary}

TRANSFER PARTNERS AVAILABLE (only recommend programs from this list):
${partnerSummary}

PRE-CALCULATED REDEMPTION VALUES (in ${currencyUnit}):
${topValueSummary}

PROGRAM CPP REFERENCE (live DB values — use these when available, they override the general table above):
${programCppSummary}

REGION CONTEXT:
- Region: ${regionCtx.displayName}
- Currency: ${regionCtx.currencySymbol} (${regionCtx.currency})
- Express valuations as ${regionCtx.cppUnitLabel}
- For India, prioritize Indian programs and partners first (Air India Maharaja Club, Taj InnerCircle, Accor ALL, IndiGo 6E Rewards) when available.

${await getBookingUrlsForPrompt(region)}

CONVERSATION RULES:
1. If the user's first message is vague (no destination, dates, travelers, or cabin class), ask 2-3 friendly clarifying questions. Keep the message short and warm.
2. Once you have enough info (destination + at least one of: dates/flexibility, travelers, cabin preference), give the full recommendation.
3. If the user asks a follow-up question after a recommendation, answer it conversationally and update the recommendation if needed.
4. Always reference the user's actual balances and any calculated ${currencyUnit} values provided. Point valuations are shown in ${cppUnit}.
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
  "reasoning": "2-3 sentences with specific programs, sweet spots, and ${currencyUnit} values",
  "flight": {
    "airline": "Specific airline",
    "cabin": "Economy | Business | First",
    "route": "e.g. ${isIndia ? 'BOM-LHR' : 'JFK-NRT'}",
    "points_needed": "e.g. 75,000 miles one-way",
    "transfer_chain": "e.g. ${isIndia ? 'HDFC Millennia → Air India Maharaja Club (1:1)' : 'Chase UR → United MileagePlus (1:1)'}",
    "notes": "Booking tip or sweet spot detail"
  },
  "hotel": {
    "name": "Specific property (e.g. ${isIndia ? 'Taj Mahal Palace Mumbai' : 'Park Hyatt Tokyo'})",
    "chain": "Loyalty program name",
    "points_per_night": "e.g. 25,000 pts/night",
    "transfer_chain": "e.g. ${isIndia ? 'HDFC Millennia → Taj InnerCircle (2:1)' : 'Chase UR → World of Hyatt (1:1)'}",
    "notes": "Category, peak/off-peak, or availability note"
  },
  "total_summary": "e.g. ~100,000 ${isIndia ? 'HDFC points' : 'Chase UR'} for 2 nights + business class roundtrip",
  "steps": ["Step 1 with specific platform/URL", "Step 2", "Step 3", "Step 4"],
  "tip": "Insider tip about award space, booking windows, or hidden value",
  "links": [
    { "label": "Button label (max 4 words)", "url": "exact URL from the list above" }
  ],
  "metadata": {
    "freshness": "ISO 8601 timestamp (current time: ${new Date().toISOString()})",
    "source": "Briefly state data sources (e.g. PointsMax DB + Gemini grounding)",
    "confidence": "low | medium | high"
  }
}
Set flight or hotel to null if not relevant. Include 2-4 links.`

  // ── Multi-turn chat ─────────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(apiKey)
  const modelCandidates = await getGeminiModelCandidatesForApiKey(apiKey)

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullResponse = ''
      try {
        await geminiCircuitBreaker.execute(async () => {
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

              const result = await withTimeout(
                chat.sendMessageStream(message),
                getAiInferenceTimeoutMs(),
                modelName,
              )
              for await (const chunk of result.stream) {
                const text = chunk.text()
                if (!text) continue
                streamedAnyChunk = true
                fullResponse += text
                controller.enqueue(encoder.encode(text))
              }

              if (i > 0) {
                logWarn('ai_recommend_model_fallback_used', {
                  requestId,
                  selected_model: modelName,
                })
              }

              logAiMetric({
                operation: 'recommend',
                model: modelName,
                latency_ms: Date.now() - startedAt,
                is_fallback: i > 0,
                success: true,
                requestId,
              })

              // Cache the full successful response
              if (fullResponse) {
                setCachedAiResponse(cacheKey, fullResponse, CACHE_TTL_MS)
              }

              return
            } catch (err) {
              markGeminiModelUnavailable(modelName, err)
              lastErr = err
              if (streamedAnyChunk) throw err
            }
          }

          throw lastErr instanceof Error ? lastErr : new Error('All Gemini model candidates failed')
        })

        controller.close()
        return
      } catch (err) {
        if (err instanceof CircuitBreakerOpenError) {
          logWarn('ai_recommend_circuit_open', {
            requestId,
            latency_ms: Date.now() - startedAt,
          })
        } else {
          logAiMetric({
            operation: 'recommend',
            model: 'all_candidates',
            latency_ms: Date.now() - startedAt,
            is_fallback: false,
            success: false,
            error: err instanceof Error ? err.message : String(err),
            requestId,
          })
        }

        // Return deterministic safe-mode response on provider failure or open circuit
        const fallback = buildSafeModeResponse(topResults, regionCtx, appOrigin)
        controller.enqueue(encoder.encode(JSON.stringify(fallback)))
        controller.close()
        return
      } finally {
        // no-op: controller closed on success/failure paths above
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-PointsMax-Cache': 'MISS',
      'X-AI-Latency-Ms': String(Date.now() - startedAt),
    },
  })
}
