import { describe, expect, it, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { POST } = await import('./route')

function makeRequest(body: unknown, opts?: { headers?: Record<string, string> }) {
  return new NextRequest('https://pointsmax.com/api/ai/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    body: JSON.stringify(body),
  })
}

function makeRequestWithRawBody(body: string, opts?: { headers?: Record<string, string> }) {
  return new NextRequest('https://pointsmax.com/api/ai/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    body,
  })
}

// Helper to run tests in safe mode
async function withSafeMode<T>(fn: () => Promise<T>): Promise<T> {
  const oldDisable = process.env.DISABLE_GEMINI
  const oldKey = process.env.GEMINI_API_KEY
  const oldAppUrl = process.env.NEXT_PUBLIC_APP_URL
  process.env.DISABLE_GEMINI = '1'
  delete process.env.GEMINI_API_KEY
  process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'

  try {
    return await fn()
  } finally {
    process.env.DISABLE_GEMINI = oldDisable
    process.env.GEMINI_API_KEY = oldKey
    process.env.NEXT_PUBLIC_APP_URL = oldAppUrl
  }
}

describe('POST /api/ai/recommend safe mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns deterministic recommendation JSON when Gemini is disabled', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'How should I use my points for Japan?',
        balances: [{ name: 'Chase Ultimate Rewards', amount: 120000 }],
        topResults: [
          {
            category: 'transfer_partner',
            label: 'Transfer to Flying Blue',
            total_value_cents: 280000,
            cpp_cents: 2.3,
            from_program: { name: 'Chase Ultimate Rewards' },
            to_program: { name: 'Flying Blue' },
          },
        ],
      })

      const res = await POST(req)
      const text = await res.text()
      const parsed = JSON.parse(text) as { type?: string; steps?: string[]; links?: Array<{ url: string }> }

      expect(res.status).toBe(200)
      expect(parsed.type).toBe('recommendation')
      expect(parsed.steps?.length).toBeGreaterThan(0)
      expect(parsed.links?.[0]?.url).toContain('/calculator')
    })
  })

  it('accepts balances-only requests without topResults', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'What can I do with these points?',
        balances: [{ name: 'Amex Membership Rewards', amount: 80000 }],
      })

      const res = await POST(req)
      const payload = JSON.parse(await res.text()) as { type?: string }
      expect(res.status).toBe(200)
      expect(payload.type).toBe('recommendation')
    })
  })

  it('returns safe-mode recommendation when AI provider fails', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'Show me something',
        balances: [{ name: 'Test', amount: 100 }],
        topResults: [] // Empty topResults
      })

      const res = await POST(req)
      const payload = JSON.parse(await res.text())
      expect(res.status).toBe(200)
      expect(payload.type).toBe('recommendation')
      expect(payload.headline).toBe('Explore your top redemption options')
      expect(payload.reasoning).toContain('Our AI is currently in safe mode')
    })
  })

  describe('Edge cases and fallback validations', () => {
    it('rejects empty message', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: '',
          balances: [{ name: 'Test', amount: 100 }],
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('Message is required')
      })
    })

    it('rejects whitespace-only message', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: '   ',
          balances: [{ name: 'Test', amount: 100 }],
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
      })
    })

    it('rejects message exceeding max length', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'a'.repeat(2001),
          balances: [{ name: 'Test', amount: 100 }],
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('too long')
      })
    })

    it('rejects history exceeding max items', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: Array(25).fill({ role: 'user', parts: [{ text: 'hi' }] }),
          message: 'Hello',
          balances: [{ name: 'Test', amount: 100 }],
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('history too long')
      })
    })

    it('returns clarifying response for empty balances', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'What should I do with my points?',
          balances: [],
        })

        const res = await POST(req)
        const payload = JSON.parse(await res.text())
        expect(res.status).toBe(200)
        expect(payload.type).toBe('clarifying')
        expect(payload.message).toContain('Add your point balances')
      })
    })

    it('rejects invalid JSON body', async () => {
      await withSafeMode(async () => {
        const req = makeRequestWithRawBody('not valid json')
        const res = await POST(req)
        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('Invalid JSON')
      })
    })

    it('rejects non-object payload', async () => {
      await withSafeMode(async () => {
        const req = makeRequest('just a string')
        const res = await POST(req)
        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('Invalid payload')
      })
    })

    it('handles balances without program_id', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Help me plan',
          balances: [{ name: 'Chase Ultimate Rewards', amount: 50000 }],
        })

        const res = await POST(req)
        expect(res.status).toBe(200)
        const payload = JSON.parse(await res.text())
        expect(payload.type).toBe('recommendation')
      })
    })

    it('handles balances with program_id', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Help me plan',
          balances: [{ name: 'Chase', amount: 50000, program_id: 'prog-123' }],
        })

        const res = await POST(req)
        expect(res.status).toBe(200)
        const payload = JSON.parse(await res.text())
        expect(payload.type).toBe('recommendation')
      })
    })

    it('filters invalid balance entries', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Help me plan',
          balances: [
            { name: 'Valid', amount: 50000 },
            { name: '', amount: 50000 }, // Invalid: empty name
            { name: 'Invalid Amount', amount: -100 }, // Invalid: negative amount
            { name: 'Also Invalid', amount: NaN }, // Invalid: NaN amount
          ],
        })

        const res = await POST(req)
        expect(res.status).toBe(200)
        const payload = JSON.parse(await res.text())
        expect(payload.type).toBe('recommendation')
      })
    })

    it('limits balances to max 25 entries', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Help me plan',
          balances: Array(30).fill(null).map((_, i) => ({ name: `Program ${i}`, amount: 10000 })),
        })

        const res = await POST(req)
        expect(res.status).toBe(200)
      })
    })

    it('handles region parameter for US', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Help me plan',
          balances: [{ name: 'Chase', amount: 50000 }],
          region: 'us',
        })

        const res = await POST(req)
        expect(res.status).toBe(200)
        const payload = JSON.parse(await res.text())
        expect(payload.type).toBe('recommendation')
      })
    })

    it('handles region parameter for India', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Help me plan',
          balances: [{ name: 'HDFC', amount: 50000 }],
          region: 'in',
        })

        const res = await POST(req)
        expect(res.status).toBe(200)
        const payload = JSON.parse(await res.text())
        expect(payload.type).toBe('recommendation')
      })
    })

    it('filters invalid topResults entries', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Best options?',
          balances: [{ name: 'Chase', amount: 50000 }],
          topResults: [
            { label: 'Valid', total_value_cents: 100000, cpp_cents: 2.0 },
            { label: '', total_value_cents: 100000, cpp_cents: 2.0 }, // Invalid: empty label
            { label: 'Invalid', total_value_cents: NaN, cpp_cents: 2.0 }, // Invalid: NaN value
          ],
        })

        const res = await POST(req)
        expect(res.status).toBe(200)
        const payload = JSON.parse(await res.text())
        expect(payload.type).toBe('recommendation')
      })
    })

    it('handles topResults with full program details', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Best transfer?',
          balances: [{ name: 'Chase UR', amount: 100000 }],
          topResults: [
            {
              category: 'transfer_partner',
              label: 'Transfer to United',
              total_value_cents: 200000,
              cpp_cents: 2.0,
              from_program: { id: 'chase-id', name: 'Chase UR', slug: 'chase' },
              to_program: { id: 'united-id', name: 'United MileagePlus', slug: 'united' },
              active_bonus_pct: 30,
            },
          ],
        })

        const res = await POST(req)
        expect(res.status).toBe(200)
        const payload = JSON.parse(await res.text())
        expect(payload.type).toBe('recommendation')
        expect(payload.headline).toContain('United')
      })
    })

    it('returns response with expected safe mode structure', async () => {
      await withSafeMode(async () => {
        const req = makeRequest({
          history: [],
          message: 'Help me use my points',
          balances: [{ name: 'Chase UR', amount: 100000 }],
        })

        const res = await POST(req)
        const payload = JSON.parse(await res.text())

        expect(res.status).toBe(200)
        expect(payload.type).toBe('recommendation')
        expect(typeof payload.headline).toBe('string')
        expect(typeof payload.reasoning).toBe('string')
        expect(payload.flight).toBeNull()
        expect(payload.hotel).toBeNull()
        expect(typeof payload.total_summary).toBe('string')
        expect(Array.isArray(payload.steps)).toBe(true)
        expect(typeof payload.tip).toBe('string')
        expect(Array.isArray(payload.links)).toBe(true)
        expect(payload.links.length).toBeGreaterThan(0)
        expect(payload.links[0]).toHaveProperty('label')
        expect(payload.links[0]).toHaveProperty('url')
        expect(payload.metadata).toBeDefined()
        expect(payload.metadata).toHaveProperty('freshness')
        expect(payload.metadata).toHaveProperty('source')
        expect(payload.metadata).toHaveProperty('confidence')
      })
    })
  })
})

describe('POST /api/ai/recommend degraded mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns complete safe-mode envelope when AI provider is unavailable', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'Best use for my points?',
        balances: [{ name: 'Chase UR', amount: 50000 }],
        topResults: [{ label: 'Transfer to Hyatt', total_value_cents: 150000, cpp_cents: 3.0 }],
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const payload = JSON.parse(await res.text())

      expect(payload.type).toBe('recommendation')
      expect(typeof payload.headline).toBe('string')
      expect(typeof payload.reasoning).toBe('string')
      expect(Array.isArray(payload.steps)).toBe(true)
      expect(payload.steps.length).toBeGreaterThan(0)
      expect(typeof payload.tip).toBe('string')
      expect(Array.isArray(payload.links)).toBe(true)
      expect(payload.metadata.source).toContain('Safe Mode')
      expect(payload.metadata.confidence).toBe('medium')
    })
  })

  it('safe-mode headline references top result label when topResults provided', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'What should I book?',
        balances: [{ name: 'Amex MR', amount: 80000 }],
        topResults: [
          { label: 'Fly Business on Air France', total_value_cents: 320000, cpp_cents: 4.0 },
        ],
      })

      const res = await POST(req)
      const payload = JSON.parse(await res.text())
      expect(payload.headline).toContain('Air France')
      expect(payload.reasoning).toContain('Air France')
    })
  })

  it('safe-mode response includes working calculator link', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'Help',
        balances: [{ name: 'Chase UR', amount: 60000 }],
      })

      const res = await POST(req)
      const payload = JSON.parse(await res.text())
      const calcLink = payload.links.find((l: { url: string }) => l.url.includes('/calculator'))
      expect(calcLink).toBeDefined()
      expect(typeof calcLink.label).toBe('string')
    })
  })

  it('response Content-Type is text/plain in degraded mode', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'Any tips?',
        balances: [{ name: 'Citi TY', amount: 40000 }],
      })

      const res = await POST(req)
      expect(res.headers.get('content-type')).toContain('text/plain')
    })
  })

  it('safe-mode with no topResults returns generic explore headline', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'Show me options',
        balances: [{ name: 'Test Program', amount: 100 }],
        topResults: [],
      })

      const res = await POST(req)
      const payload = JSON.parse(await res.text())
      expect(payload.headline).toBe('Explore your top redemption options')
      expect(payload.reasoning).toContain('safe mode')
    })
  })

  it('safe-mode steps instruct to verify availability before transfer', async () => {
    await withSafeMode(async () => {
      const req = makeRequest({
        history: [],
        message: 'What should I do?',
        balances: [{ name: 'Chase UR', amount: 75000 }],
        topResults: [{ label: 'United Business', total_value_cents: 200000, cpp_cents: 2.7 }],
      })

      const res = await POST(req)
      const payload = JSON.parse(await res.text())
      const stepsText = payload.steps.join(' ').toLowerCase()
      expect(stepsText).toMatch(/availab/)
    })
  })
})
