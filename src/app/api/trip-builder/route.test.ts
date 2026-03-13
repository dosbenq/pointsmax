import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'example-anon-key'

const { POST } = await import('./route')

function makeRequest(body: unknown) {
  return new NextRequest('https://pointsmax.com/api/trip-builder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBalance = {
  program_id: '11111111-1111-1111-1111-111111111111',
  amount: 25000,
}

function getFutureDate(daysFromToday: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

describe('POST /api/trip-builder validation', () => {
  it('rejects return_date on/before start_date', async () => {
    const req = makeRequest({
      destination_name: 'Tokyo',
      origin: 'JFK',
      destination: 'NRT',
      start_date: '2026-03-10',
      return_date: '2026-03-10',
      passengers: 1,
      cabin: 'business',
      hotel_nights: 3,
      balances: [validBalance],
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('return_date')
  })

  it('rejects malformed balance UUIDs', async () => {
    const req = makeRequest({
      destination_name: 'Tokyo',
      origin: 'JFK',
      destination: 'NRT',
      start_date: getFutureDate(10),
      return_date: getFutureDate(15),
      passengers: 1,
      cabin: 'business',
      hotel_nights: 3,
      balances: [{ program_id: 'bad', amount: 25000 }],
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('program_id')
  })

  it('rejects past start dates', async () => {
    const req = makeRequest({
      destination_name: 'Tokyo',
      origin: 'JFK',
      destination: 'NRT',
      start_date: '2020-01-01',
      return_date: '2020-01-05',
      passengers: 1,
      cabin: 'business',
      hotel_nights: 3,
      balances: [validBalance],
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('today or later')
  })

  it('rejects identical origin and destination', async () => {
    const req = makeRequest({
      destination_name: 'New York',
      origin: 'JFK',
      destination: 'JFK',
      start_date: getFutureDate(10),
      return_date: getFutureDate(15),
      passengers: 1,
      cabin: 'business',
      hotel_nights: 3,
      balances: [validBalance],
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('must be different')
  })

  it('rejects date ranges wider than max span', async () => {
    const req = makeRequest({
      destination_name: 'Tokyo',
      origin: 'JFK',
      destination: 'NRT',
      start_date: getFutureDate(1),
      return_date: getFutureDate(60),
      passengers: 1,
      cabin: 'business',
      hotel_nights: 3,
      balances: [validBalance],
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Date range too wide')
  })
})
