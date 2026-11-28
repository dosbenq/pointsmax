import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getCatalogProgramBySlug, getCatalogTransferPartners } from '@/lib/catalog'

const { bonusesMock } = vi.hoisted(() => ({ bonusesMock: vi.fn() }))
vi.mock('@/lib/transfer-bonuses', () => ({ getActiveTransferBonuses: bonusesMock }))
vi.mock('@/lib/api-security', () => ({ enforceJsonContentLength: () => null, enforceRateLimit: async () => null }))

const { POST } = await import('./route')

const CHASE = getCatalogProgramBySlug('chase-ur')!.id
const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/transfer-options', { method: 'POST', body: JSON.stringify(body) }))

describe('POST /api/transfer-options', () => {
  beforeEach(() => bonusesMock.mockReset().mockResolvedValue([]))

  it('returns the conversion for each reachable airline and links to its own search', async () => {
    const res = await post({
      region: 'US',
      balances: [{ program_id: CHASE, amount: 120000 }],
      trip: { origin: 'jfk', destination: 'LHR', date: '2026-12-20', cabin: 'business', passengers: 2 },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.seats).toBe('not_checked')
    const united = body.options.find((o: { program_slug: string }) => o.program_slug === 'united')
    expect(united.paths[0]).toMatchObject({ from_program_name: 'Chase Ultimate Rewards', points: 120000, miles: 120000 })
    expect(united.airline_search.url).toContain('united.com')
  })

  it('applies a verified bonus running today', async () => {
    const flyingBlue = getCatalogProgramBySlug('flying-blue')!.id
    const link = getCatalogTransferPartners().find((p) => p.from_program_id === CHASE && p.to_program_id === flyingBlue)!
    bonusesMock.mockResolvedValue([{ transfer_partner_id: link.id, bonus_pct: 25, end_date: '2026-12-31' }])

    const body = await (await post({ region: 'US', balances: [{ program_id: CHASE, amount: 40000 }] })).json()
    expect(body.options[0]).toMatchObject({ program_slug: 'flying-blue' })
    expect(body.options[0].paths[0]).toMatchObject({ bonus_pct: 25, miles: 50000 })
    expect(body.options[0].airline_search).toBeNull() // no trip given
  })

  it('rejects malformed balances', async () => {
    expect((await post({ balances: 'lots' })).status).toBe(400)
    expect((await post({ balances: [{ program_id: CHASE, amount: -5 }] })).status).toBe(400)
  })

  it('contains no modeled values', async () => {
    const text = await (await post({ region: 'US', balances: [{ program_id: CHASE, amount: 100000 }] })).text()
    for (const modeled of ['estimated', 'cpp', 'cash_value', 'value_cents', 'is_reachable', 'points_needed']) {
      expect(text).not.toContain(modeled)
    }
  })
})
