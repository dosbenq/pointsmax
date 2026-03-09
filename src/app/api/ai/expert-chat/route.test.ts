import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockRpc,
  mockFrom,
  mockGenerateContent,
  mockEmbedContent,
  mockCircuitExecute,
} = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockEmbedContent: vi.fn(),
  mockCircuitExecute: vi.fn(),
}))

vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

vi.mock('@/lib/logger', () => ({
  getRequestId: vi.fn(() => 'expert-test'),
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/ai-cache', () => ({
  generateAiCacheKey: vi.fn((_prefix: string, value: unknown) => JSON.stringify(value)),
  getCachedAiResponse: vi.fn(() => null),
  setCachedAiResponse: vi.fn(),
  logAiCacheMetric: vi.fn(),
}))

vi.mock('@/lib/gemini-models', () => ({
  getGeminiModelCandidatesForApiKey: vi.fn(async () => ['gemini-test']),
  markGeminiModelUnavailable: vi.fn(),
}))

vi.mock('@/lib/circuit-breaker', () => {
  class CircuitBreakerOpenError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'CircuitBreakerOpenError'
    }
  }

  return {
    CircuitBreakerOpenError,
    geminiCircuitBreaker: {
      execute: mockCircuitExecute,
    },
  }
})

vi.mock('@/lib/supabase', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}))

vi.mock('@google/generative-ai', () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel({ model }: { model: string }) {
      if (model === 'text-embedding-004') {
        return {
          embedContent: mockEmbedContent,
        }
      }
      return {
        generateContent: mockGenerateContent,
      }
    }
  }

  return { GoogleGenerativeAI: MockGoogleGenerativeAI }
})

const { POST } = await import('./route')
const { CircuitBreakerOpenError } = await import('@/lib/circuit-breaker')

function makeRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/ai/expert-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/ai/expert-chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'

    mockEmbedContent.mockResolvedValue({
      embedding: { values: [0.1, 0.2, 0.3] },
    })
    mockRpc.mockResolvedValue({ data: [], error: { message: 'vector failed' } })
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }))
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'US expert response' },
    })
    mockCircuitExecute.mockImplementation(async (fn: () => Promise<unknown>) => fn())
  })

  it('defaults invalid region values to us', async () => {
    const res = await POST(makeRequest({ message: 'Help me choose a card', region: 'US' }))
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.reply).toContain('US expert response')
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('does not fall back to a full-table ilike scan when vector search fails', async () => {
    await POST(makeRequest({ message: 'What should I do?', region: 'us' }))

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns 503 when the Gemini circuit breaker is open', async () => {
    mockCircuitExecute.mockRejectedValueOnce(new CircuitBreakerOpenError('open'))

    const res = await POST(makeRequest({ message: 'Need advice', region: 'us' }))
    const payload = await res.json()

    expect(res.status).toBe(503)
    expect(payload.error).toContain('temporarily unavailable')
  })
})
