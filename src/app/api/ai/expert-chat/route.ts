import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getGeminiModelCandidatesForApiKey, markGeminiModelUnavailable } from '@/lib/gemini-models'
import { logError, getRequestId, logWarn } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase'
import { REGIONS, type Region } from '@/lib/regions'
import {
  generateAiCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
  logAiCacheMetric,
} from '@/lib/ai-cache'
import { CircuitBreakerOpenError, geminiCircuitBreaker } from '@/lib/circuit-breaker'

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

type KnowledgeChunk = {
  id: string
  source_id?: string
  source_url?: string
  title?: string
  content: string
  similarity?: number
}

const MAX_BODY_BYTES = 24_000
const MAX_MESSAGE_CHARS = 1_500

function sanitizeMessage(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeRegion(value: unknown): Region {
  return value === 'in' ? 'in' : 'us'
}

function getRequestScope(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ua = req.headers.get('user-agent') ?? 'unknown'
  return `${ip}|${ua}`
}

async function fetchKnowledgeChunks(queryVector: number[], requestId: string): Promise<KnowledgeChunk[]> {
  const db = createAdminClient()

  const rpc = await db.rpc('search_knowledge_docs', {
    query_embedding: queryVector,
    match_threshold: 0.45,
    match_count: 6,
  } as never)

  const rpcRows = Array.isArray(rpc.data) ? (rpc.data as Array<Record<string, unknown>>) : []

  if (!rpc.error && rpcRows.length > 0) {
    return rpcRows
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
      .map((row) => ({
        id: String(row.id ?? ''),
        source_id: typeof row.source_id === 'string' ? row.source_id : undefined,
        source_url: typeof row.source_url === 'string' ? row.source_url : undefined,
        title: typeof row.title === 'string' ? row.title : undefined,
        content: typeof row.content === 'string' ? row.content : '',
        similarity: typeof row.similarity === 'number' ? row.similarity : undefined,
      }))
      .filter((row) => row.id && row.content)
  }

  logWarn('expert_chat_knowledge_context_unavailable', {
    requestId,
    rpc_error: rpc.error?.message ?? null,
    rpc_rows: rpcRows.length,
  })
  return []
}

function buildContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return 'No channel-specific context found. Use general knowledge and say this is general guidance.'
  }

  return chunks
    .map((chunk, idx) => {
      const heading = chunk.title ?? chunk.source_id ?? `Source ${idx + 1}`
      return `# ${heading}\n${chunk.content}`
    })
    .join('\n\n')
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError

  const rateError = await enforceRateLimit(req, {
    namespace: 'expert_chat_ip',
    maxRequests: 18,
    windowMs: 10 * 60 * 1000,
  })
  if (rateError) return rateError

  const idempotencyKey = req.headers.get('Idempotency-Key')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const message = sanitizeMessage((body as { message?: unknown })?.message)
  const region = normalizeRegion((body as { region?: unknown })?.region)
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: `message too long (max ${MAX_MESSAGE_CHARS})` }, { status: 400 })
  }
  const requestScope = getRequestScope(req)

  // Idempotency-Key deduplication: explicit per-call deduplication via header.
  // Cache is additionally scoped by message+request fingerprint to prevent
  // cross-request replay from identical Idempotency-Key reuse.
  if (idempotencyKey) {
    const idemCacheKey = generateAiCacheKey('expert-chat-idem', {
      idempotencyKey,
      message,
      region,
      requestScope,
    })
    const cached = getCachedAiResponse<Record<string, unknown>>(idemCacheKey)
    if (cached) {
      logAiCacheMetric('hit', 'expert-chat-idem', requestId)
      return NextResponse.json(cached, {
        headers: {
          'X-PointsMax-Cache': 'HIT',
          'X-Idempotent-Replayed': 'true',
        },
      })
    }
    logAiCacheMetric('miss', 'expert-chat-idem', requestId)
  }

  // Content-based cache: when no Idempotency-Key, deduplicate identical messages.
  // Returns HIT without X-Idempotent-Replayed (transparent caching, not explicit dedup).
  if (!idempotencyKey) {
    const contentCacheKey = generateAiCacheKey('expert-chat', { message, region })
    const contentCached = getCachedAiResponse<Record<string, unknown>>(contentCacheKey)
    if (contentCached) {
      logAiCacheMetric('hit', 'expert-chat', requestId)
      return NextResponse.json(contentCached, {
        headers: { 'X-PointsMax-Cache': 'HIT' },
      })
    }
    logAiCacheMetric('miss', 'expert-chat', requestId)
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 503 })

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
    const embeddingResult = await embeddingModel.embedContent(message)
    const queryVector = embeddingResult.embedding.values

    const chunks = await fetchKnowledgeChunks(queryVector, requestId)
    const contextText = buildContext(chunks)

    const modelNames = await getGeminiModelCandidatesForApiKey(apiKey)
    const prompt = `
You are the PointsMax ${REGIONS[region].label} Credit Card & Loyalty Expert.
${REGIONS[region].expertAgentPrompt}

Rules:
- Prefer the supplied context first.
- If context is insufficient, clearly say: "Based on my general knowledge".
- Be concrete with numbers, caveats, and step-by-step actions.
- Never invent program rules or transfer ratios.

Context:\n${contextText}

User question: ${message}
    `.trim()

    let reply = ''
    try {
      await geminiCircuitBreaker.execute(async () => {
        for (const modelName of modelNames) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName })
            const result = await model.generateContent(prompt)
            reply = result.response.text().trim()
            if (reply) return
          } catch (err) {
            markGeminiModelUnavailable(modelName, err)
          }
        }
        throw new Error('AI model unavailable. Please retry shortly.')
      })
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        logWarn('expert_chat_circuit_open', { requestId })
        return NextResponse.json({ error: 'Expert assistant temporarily unavailable. Please retry shortly.' }, { status: 503 })
      }
      throw error
    }

    if (!reply) {
      return NextResponse.json({ error: 'AI model unavailable. Please retry shortly.' }, { status: 503 })
    }

    const responseBody = {
      reply,
      sources: chunks.map((c) => ({
        id: c.id,
        source_id: c.source_id ?? null,
        source_url: c.source_url ?? null,
        title: c.title ?? null,
        similarity: typeof c.similarity === 'number' ? c.similarity : null,
      })),
    }

    // Store in the appropriate cache
    if (idempotencyKey) {
      const idemCacheKey = generateAiCacheKey('expert-chat-idem', {
        idempotencyKey,
        message,
        region,
        requestScope,
      })
      setCachedAiResponse(idemCacheKey, responseBody, IDEMPOTENCY_TTL_MS)
    } else {
      const contentCacheKey = generateAiCacheKey('expert-chat', { message, region })
      setCachedAiResponse(contentCacheKey, responseBody)
    }

    return NextResponse.json(responseBody, {
      headers: { 'X-PointsMax-Cache': 'MISS' },
    })
  } catch (error) {
    logError('expert_chat_failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Expert assistant unavailable' }, { status: 500 })
  }
}
