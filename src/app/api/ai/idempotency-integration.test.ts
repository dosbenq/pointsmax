/**
 * API route tests for duplicate request handling via Idempotency-Key header.
 *
 * These tests verify that:
 *  1. A first POST without an Idempotency-Key processes normally (MISS).
 *  2. A second POST with the same Idempotency-Key returns the stored response
 *     without re-invoking the AI (HIT + X-Idempotent-Replayed: true).
 *  3. A different Idempotency-Key always results in a fresh call.
 *  4. Requests without an Idempotency-Key are not affected by the header path.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function () {
      return {
        getGenerativeModel: vi.fn().mockImplementation(function () {
          return {
            generateContent: vi.fn().mockResolvedValue({
              response: { text: () => 'AI response text' },
            }),
            embedContent: vi.fn().mockResolvedValue({
              embedding: { values: new Array(768).fill(0.1) },
            }),
          }
        }),
      }
    }),
  }
})

// Fresh mock object per createAdminClient() call — avoids accumulated state
vi.mock('@/lib/supabase', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    // Proper thenable: calls resolve so `await db.from(...).limit(n)` settles
    then: vi.fn().mockImplementation((resolve: (v: { data: unknown[]; error: null }) => void) => {
      resolve({ data: [], error: null })
    }),
  })),
}))

vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn().mockReturnValue(null),
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/gemini-models', () => ({
  getGeminiModelCandidatesForApiKey: vi.fn().mockResolvedValue(['gemini-2.0-flash']),
  markGeminiModelUnavailable: vi.fn(),
}))

// Import route after mocks are registered (top-level await is valid in ESM test files)
const expertChatRoute = await import('./expert-chat/route')

// ── Helper ────────────────────────────────────────────────────────────────────

function makeRequest(idempotencyKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }
  return new NextRequest('https://pointsmax.com/api/ai/expert-chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'What is the best airline card for India travel?' }),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Expert Chat — Idempotency-Key header deduplication', () => {
  beforeEach(() => {
    // Clear AI cache (idempotency keys are stored here too)
    const g = globalThis as typeof globalThis & {
      __pointsmaxAiResponseCache?: Map<string, unknown>
    }
    g.__pointsmaxAiResponseCache?.clear()

    process.env.GEMINI_API_KEY = 'test-gemini-key'
  })

  it('first request returns MISS (no idempotency key)', async () => {
    const res = await expertChatRoute.POST(makeRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('X-PointsMax-Cache')).toBe('MISS')
    expect(res.headers.get('X-Idempotent-Replayed')).toBeNull()
  })

  it('first request with idempotency key returns MISS', async () => {
    const res = await expertChatRoute.POST(makeRequest('idem-key-001'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-PointsMax-Cache')).toBe('MISS')
    expect(res.headers.get('X-Idempotent-Replayed')).toBeNull()
  })

  it('second request with same idempotency key returns HIT + replayed header', async () => {
    // First call — populates the idempotency cache
    await expertChatRoute.POST(makeRequest('idem-key-002'))

    // Second call with the same key
    const res2 = await expertChatRoute.POST(makeRequest('idem-key-002'))
    expect(res2.status).toBe(200)
    expect(res2.headers.get('X-PointsMax-Cache')).toBe('HIT')
    expect(res2.headers.get('X-Idempotent-Replayed')).toBe('true')
  })

  it('replayed response body matches original response body', async () => {
    const res1 = await expertChatRoute.POST(makeRequest('idem-key-003'))
    const body1 = await res1.json()

    const res2 = await expertChatRoute.POST(makeRequest('idem-key-003'))
    const body2 = await res2.json()

    expect(body2).toEqual(body1)
    expect(body2).toHaveProperty('reply')
    expect(body2).toHaveProperty('sources')
  })

  it('different idempotency keys result in separate cache entries', async () => {
    await expertChatRoute.POST(makeRequest('idem-key-A'))

    // Key B has never been seen — should be a MISS
    const resB = await expertChatRoute.POST(makeRequest('idem-key-B'))
    expect(resB.headers.get('X-PointsMax-Cache')).toBe('MISS')
    expect(resB.headers.get('X-Idempotent-Replayed')).toBeNull()
  })

  it('requests without idempotency key are not tagged as idempotent replays', async () => {
    const res = await expertChatRoute.POST(makeRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Idempotent-Replayed')).toBeNull()
  })
})
