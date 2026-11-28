import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api-security', () => ({ enforceRateLimit: vi.fn(async () => null) }))

const { GET } = await import('./route')

describe('GET /api/valuations', () => {
  it('returns one sorted value per active program, with India in paise', async () => {
    const res = await GET(new Request('http://localhost/api/valuations'))
    const { valuations } = await res.json()

    expect(res.status).toBe(200)
    expect(valuations.length).toBeGreaterThan(40)
    const names = valuations.map((row: { program_name: string }) => row.program_name)
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b)))

    const chase = valuations.find((row: { program_slug: string }) => row.program_slug === 'chase-ur')
    expect(chase).toMatchObject({ cpp_cents: 2.05, source: 'tpg' })
    expect(chase.updated_at).toBe(chase.effective_date)
    expect(valuations.find((row: { program_slug: string }) => row.program_slug === 'hdfc-millennia').cpp_cents).toBe(50)
  })
})
