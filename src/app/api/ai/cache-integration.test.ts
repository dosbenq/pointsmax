import { describe, expect, it, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Import the route handlers
const recommendRoute = await import('./recommend/route')
const expertChatRoute = await import('./expert-chat/route')

// Mock Gemini to avoid actual API calls
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function () {
      return {
        getGenerativeModel: vi.fn().mockImplementation(function () {
          return {
            startChat: vi.fn().mockImplementation(function () {
              return {
                sendMessageStream: vi.fn().mockImplementation(async () => ({
                  stream: (async function* () {
                    yield { text: () => 'Mocked stream ' }
                    yield { text: () => 'response' }
                  })(),
                })),
              }
            }),
            generateContent: vi.fn().mockImplementation(async () => ({
              response: { text: () => 'Mocked static response' },
            })),
            embedContent: vi.fn().mockImplementation(async () => ({
              embedding: { values: new Array(768).fill(0) },
            })),
          }
        }),
      }
    }),
  }
})

// Mock gemini-models to allow Gemini in tests
vi.mock('@/lib/gemini-models', () => ({
  isGeminiDisabled: vi.fn().mockReturnValue(false),
  getGeminiModelCandidatesForApiKey: vi.fn().mockResolvedValue(['gemini-pro']),
  markGeminiModelUnavailable: vi.fn(),
  isGeminiModelUnavailable: vi.fn().mockReturnValue(false),
}))

// Mock Supabase to avoid DB calls
vi.mock('@/lib/supabase', () => ({
  createServerDbClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    // then must call resolve() to satisfy `await builder.limit(n)`
    then: vi.fn().mockImplementation((resolve: (v: { data: unknown[]; error: null }) => void) => {
      resolve({ data: [], error: null })
    }),
  })),
  createAdminClient: vi.fn().mockImplementation(() => ({
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (v: { data: unknown[]; error: null }) => void) => {
      resolve({ data: [], error: null })
    }),
  })),
}))

// Mock booking-urls to avoid external calls
vi.mock('@/lib/booking-urls', () => ({
  getBookingUrlsForPrompt: vi.fn().mockResolvedValue('Mocked booking URLs'),
}))

// Mock api-security to avoid external rate-limiter calls in tests
vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn().mockReturnValue(null),
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

function makeRequest(url: string, body: unknown, headers?: Record<string, string>) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('AI Cache Integration', () => {
  beforeEach(() => {
    // Clear global cache
    const globalRef = globalThis as typeof globalThis & { __pointsmaxAiResponseCache?: Map<string, unknown> }
    if (globalRef.__pointsmaxAiResponseCache) {
      globalRef.__pointsmaxAiResponseCache.clear()
    }
    
    // Set up environment
    process.env.GEMINI_API_KEY = 'test-key'
    delete process.env.DISABLE_GEMINI
    
    vi.clearAllMocks()
  })

  describe('Expert Chat Caching', () => {
    it('returns MISS then HIT for same message', async () => {
      const payload = { message: 'What is the best card for India?' }
      
      // First request (MISS)
      const req1 = makeRequest('https://pointsmax.com/api/ai/expert-chat', payload)
      const res1 = await expertChatRoute.POST(req1)
      expect(res1.headers.get('X-PointsMax-Cache')).toBe('MISS')
      const data1 = await res1.json()
      expect(data1.reply).toBe('Mocked static response')

      // Second request (HIT)
      const req2 = makeRequest('https://pointsmax.com/api/ai/expert-chat', payload)
      const res2 = await expertChatRoute.POST(req2)
      expect(res2.headers.get('X-PointsMax-Cache')).toBe('HIT')
      const data2 = await res2.json()
      expect(data2.reply).toBe('Mocked static response')
      expect(data2).toEqual(data1)
    })
    
    it('returns MISS for different messages', async () => {
      const payload1 = { message: 'Message 1' }
      const payload2 = { message: 'Message 2' }
      
      const res1 = await expertChatRoute.POST(makeRequest('https://pointsmax.com/api/ai/expert-chat', payload1))
      expect(res1.headers.get('X-PointsMax-Cache')).toBe('MISS')
      
      const res2 = await expertChatRoute.POST(makeRequest('https://pointsmax.com/api/ai/expert-chat', payload2))
      expect(res2.headers.get('X-PointsMax-Cache')).toBe('MISS')
    })

    it('shares content cache across different user agents for the same region and question', async () => {
      const payload = { message: 'How do I redeem HDFC Infinia points?', region: 'in' }

      const req1 = makeRequest('https://pointsmax.com/api/ai/expert-chat', payload, {
        'user-agent': 'Chrome',
        'x-forwarded-for': '1.1.1.1',
      })
      const req2 = makeRequest('https://pointsmax.com/api/ai/expert-chat', payload, {
        'user-agent': 'Safari',
        'x-forwarded-for': '2.2.2.2',
      })

      const res1 = await expertChatRoute.POST(req1)
      const res2 = await expertChatRoute.POST(req2)

      expect(res1.headers.get('X-PointsMax-Cache')).toBe('MISS')
      expect(res2.headers.get('X-PointsMax-Cache')).toBe('HIT')
    })
  })

  describe('Recommend Caching (Streaming)', () => {
    it('returns MISS then HIT for same parameters', async () => {
      const payload = { 
        message: 'Plan my trip', 
        balances: [{ name: 'Chase', amount: 100000 }],
        history: []
      }
      
      // First request (MISS)
      const req1 = makeRequest('https://pointsmax.com/api/ai/recommend', payload)
      const res1 = await recommendRoute.POST(req1)
      expect(res1.headers.get('X-PointsMax-Cache')).toBe('MISS')
      const text1 = await res1.text()
      expect(text1).toBe('Mocked stream response')

      // Second request (HIT)
      const req2 = makeRequest('https://pointsmax.com/api/ai/recommend', payload)
      const res2 = await recommendRoute.POST(req2)
      expect(res2.headers.get('X-PointsMax-Cache')).toBe('HIT')
      const text2 = await res2.text()
      expect(text2).toBe('Mocked stream response')
      expect(text2).toBe(text1)
    })
    
    it('returns MISS for different balances', async () => {
      const payload1 = { 
        message: 'Plan', 
        balances: [{ name: 'Chase', amount: 100000 }]
      }
      const payload2 = { 
        message: 'Plan', 
        balances: [{ name: 'Chase', amount: 100001 }]
      }
      
      const res1 = await recommendRoute.POST(makeRequest('https://pointsmax.com/api/ai/recommend', payload1))
      expect(res1.headers.get('X-PointsMax-Cache')).toBe('MISS')
      
      const res2 = await recommendRoute.POST(makeRequest('https://pointsmax.com/api/ai/recommend', payload2))
      expect(res2.headers.get('X-PointsMax-Cache')).toBe('MISS')
    })
  })
})
