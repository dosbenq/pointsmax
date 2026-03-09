import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  __clearNarrativeCacheForTests,
  __getNarrativeCacheSizeForTests,
  generateNarrative,
} from './helpers'

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify({
        headline: 'Test Headline',
        body: 'Test Body',
        top_pick_slug: 'test',
        warnings: [],
        booking_tips: []
      })
    }
  })
}))

vi.mock('@google/generative-ai', () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent
      }
    }
  }
  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI
  }
})

vi.mock('@/lib/gemini-models', () => ({
  getGeminiModelCandidatesForApiKey: vi.fn().mockResolvedValue(['gemini-1.5-pro']),
  isGeminiDisabled: vi.fn().mockReturnValue(false),
  markGeminiModelUnavailable: vi.fn()
}))

describe('generateNarrative caching', () => {
  const getParams = (origin = 'JFK') => ({
    origin,
    destination: 'LHR',
    cabin: 'business' as const,
    passengers: 1,
    start_date: '2026-01-01',
    end_date: '2026-01-02'
  })
  const options = [{
    program_slug: 'test',
    program_name: 'Test',
    estimated_miles: 50000,
    estimated_cash_value_cents: 100000,
    transfer_chain: null,
    has_real_availability: true,
    is_reachable: true
  }]

  beforeEach(() => {
    vi.clearAllMocks()
    __clearNarrativeCacheForTests()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('calls the AI model on first request and returns narrative', async () => {
    const params = getParams('JFK')
    const result = await generateNarrative(params, options)
    expect(result).not.toBeNull()
    expect(result?.headline).toBe('Test Headline')
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('returns cached narrative on second request with same params/options', async () => {
    const params = getParams('SFO') // Different from other tests to avoid cache hits
    // First call to populate cache
    await generateNarrative(params, options)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)

    // Second call should hit cache
    const result = await generateNarrative(params, options)
    expect(result).not.toBeNull()
    expect(result?.headline).toBe('Test Headline')
    expect(mockGenerateContent).toHaveBeenCalledTimes(1) // Still 1
  })

  it('calls AI again if params differ', async () => {
    const params1 = getParams('LAX')
    const params2 = getParams('SEA')
    
    await generateNarrative(params1, options)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)

    await generateNarrative(params2, options)
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('extracts JSON when the model wraps it in extra text', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => `Preface ${JSON.stringify({
          headline: 'Wrapped',
          body: 'Wrapped Body',
          top_pick_slug: 'test',
          warnings: [],
          booking_tips: [],
        })} trailing`,
      },
    })

    const result = await generateNarrative(getParams('BOS'), options)
    expect(result?.headline).toBe('Wrapped')
  })

  it('evicts old entries when the cache exceeds the size cap', async () => {
    for (let index = 0; index < 205; index += 1) {
      await generateNarrative(getParams('JFK'), [
        {
          ...options[0],
          program_slug: `test-${index}`,
        },
      ])
    }

    expect(__getNarrativeCacheSizeForTests()).toBeLessThanOrEqual(200)
  })
})
