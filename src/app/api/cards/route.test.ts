import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api-security', () => ({ enforceRateLimit: vi.fn(async () => null) }))

const { GET } = await import('./route')

describe('GET /api/cards', () => {
  it('returns US cards with rates, program values and cache headers', async () => {
    const res = await GET(new Request('http://localhost/api/cards'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600')
    expect(body.geography).toBe('US')
    expect(body.cards.length).toBeGreaterThan(0)

    const sapphire = body.cards.find((card: { name: string }) => card.name === 'Chase Sapphire Preferred')
    expect(sapphire).toMatchObject({ program_slug: 'chase-ur', currency: 'USD', geography: 'US' })
    expect(sapphire.cpp_cents).toBeGreaterThan(1)
    expect(sapphire.earning_rates.dining).toBeGreaterThan(1)
  })

  it('returns India cards with values in paise, exactly as stored', async () => {
    const res = await GET(new Request('http://localhost/api/cards?geography=IN'))
    const body = await res.json()

    expect(body.geography).toBe('IN')
    expect(body.cards.every((card: { geography: string }) => card.geography === 'IN')).toBe(true)
    const millennia = body.cards.find((card: { program_slug: string }) => card.program_slug === 'hdfc-millennia')
    expect(millennia?.cpp_cents).toBe(50)
    expect(millennia?.currency).toBe('INR')
  })
})
