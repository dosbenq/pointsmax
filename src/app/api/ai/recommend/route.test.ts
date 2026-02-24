import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/ai/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/ai/recommend safe mode', () => {
  it('returns deterministic recommendation JSON when Gemini is disabled', async () => {
    const oldDisable = process.env.DISABLE_GEMINI
    const oldKey = process.env.GEMINI_API_KEY
    const oldAppUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.DISABLE_GEMINI = '1'
    delete process.env.GEMINI_API_KEY
    process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'

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

    try {
      const res = await POST(req)
      const text = await res.text()
      const parsed = JSON.parse(text) as { type?: string; steps?: string[]; links?: Array<{ url: string }> }

      expect(res.status).toBe(200)
      expect(parsed.type).toBe('recommendation')
      expect(parsed.steps?.length).toBeGreaterThan(0)
      expect(parsed.links?.[0]?.url).toContain('/calculator')
    } finally {
      process.env.DISABLE_GEMINI = oldDisable
      process.env.GEMINI_API_KEY = oldKey
      process.env.NEXT_PUBLIC_APP_URL = oldAppUrl
    }
  })

  it('accepts balances-only requests without topResults', async () => {
    const oldDisable = process.env.DISABLE_GEMINI
    const oldKey = process.env.GEMINI_API_KEY
    process.env.DISABLE_GEMINI = '1'
    delete process.env.GEMINI_API_KEY

    const req = makeRequest({
      history: [],
      message: 'What can I do with these points?',
      balances: [{ name: 'Amex Membership Rewards', amount: 80000 }],
    })

    try {
      const res = await POST(req)
      const payload = JSON.parse(await res.text()) as { type?: string }
      expect(res.status).toBe(200)
      expect(payload.type).toBe('recommendation')
    } finally {
      process.env.DISABLE_GEMINI = oldDisable
      process.env.GEMINI_API_KEY = oldKey
    }
  })
})
