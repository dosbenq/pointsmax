import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'example-anon-key'

const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/award-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBalance = {
  program_id: '11111111-1111-1111-1111-111111111111',
  amount: 25000,
}

describe('POST /api/award-search validation', () => {
  it('rejects invalid origin IATA code', async () => {
    const req = makeRequest({
      origin: 'JF',
      destination: 'NRT',
      cabin: 'business',
      passengers: 1,
      start_date: '2026-03-01',
      end_date: '2026-03-05',
      balances: [validBalance],
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error?.message?.toLowerCase()).toContain('origin')
  })

  it('rejects end_date before start_date', async () => {
    const req = makeRequest({
      origin: 'JFK',
      destination: 'NRT',
      cabin: 'business',
      passengers: 1,
      start_date: '2026-03-05',
      end_date: '2026-03-01',
      balances: [validBalance],
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error?.message?.toLowerCase()).toContain('end_date')
  })

  it('rejects balances with malformed UUID', async () => {
    const req = makeRequest({
      origin: 'JFK',
      destination: 'NRT',
      cabin: 'business',
      passengers: 1,
      start_date: '2026-03-01',
      end_date: '2026-03-05',
      balances: [{ program_id: 'not-a-uuid', amount: 25000 }],
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error?.message?.toLowerCase()).toContain('program_id')
  })
})
