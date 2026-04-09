import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}))

vi.mock('@/lib/api-security', () => ({
  enforceJsonContentLength: vi.fn(() => null),
  enforceRateLimit: vi.fn(async () => null),
}))

vi.mock('@/lib/logger', () => ({
  getRequestId: vi.fn(() => 'parse-test'),
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/gemini-models', () => ({
  isGeminiDisabled: vi.fn(() => false),
  getGeminiModelCandidatesForApiKey: vi.fn(async () => ['gemini-test']),
  markGeminiModelUnavailable: vi.fn(),
}))

vi.mock('@google/generative-ai', () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent }
    }
  }

  return { GoogleGenerativeAI: MockGoogleGenerativeAI }
})

const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/award-search/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/award-search/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('returns sanitized Gemini output', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          origin: 'JFK',
          destination: 'HND',
          cabin: 'business',
          start_date: '2026-03-01',
          end_date: '2026-03-31',
          passengers: 2,
        }),
      },
    })

    const response = await POST(makeRequest({ query: 'business class to Tokyo in March', home_airport: 'JFK' }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.confidence).toBe('high')
    expect(payload.params.destination).toBe('HND')
    expect(payload.params.passengers).toBe(2)
  })

  it('nulls invalid Gemini fields instead of failing', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          origin: 'not-real',
          destination: 'tokyo',
          cabin: 'space',
          start_date: 'march',
          end_date: '2026-04-40',
          passengers: 99,
        }),
      },
    })

    const response = await POST(makeRequest({ query: 'to Tokyo someday', home_airport: 'SFO' }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.confidence).toBe('low')
    expect(payload.params.origin).toBeNull()
    expect(payload.params.destination).toBeNull()
    expect(payload.params.cabin).toBeNull()
  })

  it('falls back to heuristic parsing when Gemini is unavailable', async () => {
    delete process.env.GEMINI_API_KEY

    const response = await POST(makeRequest({ query: 'business class to Tokyo in March', home_airport: 'JFK' }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.params.origin).toBe('JFK')
    expect(payload.params.destination).toBe('HND')
    expect(payload.params.cabin).toBe('business')
    // March is in the past relative to current date, so next year is correct
    const now = new Date()
    const expectedYear = 2 < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear()
    expect(payload.params.start_date).toBe(`${expectedYear}-03-01`)
    expect(payload.confidence).toBe('high')
  })
})
