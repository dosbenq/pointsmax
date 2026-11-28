import { afterEach, describe, expect, it, vi } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  createServerDbClient: () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      lte: () => builder,
      gte: () => queryMock(),
    }
    return { from: () => builder }
  },
}))
vi.mock('@/lib/logger', () => ({ logWarn: vi.fn(), logError: vi.fn() }))

const { getActiveTransferBonuses } = await import('./transfer-bonuses')

afterEach(() => {
  vi.useRealTimers()
  queryMock.mockReset()
})

describe('getActiveTransferBonuses', () => {
  it('returns the verified bonuses running today', async () => {
    queryMock.mockResolvedValue({ data: [{ transfer_partner_id: 'tp', bonus_pct: 30, end_date: '2026-12-31' }], error: null })
    expect(await getActiveTransferBonuses('2026-12-01')).toEqual([{ transfer_partner_id: 'tp', bonus_pct: 30, end_date: '2026-12-31' }])
  })

  it('gives up after 2 seconds instead of holding up a search', async () => {
    vi.useFakeTimers()
    queryMock.mockReturnValue(new Promise(() => {}))
    const pending = getActiveTransferBonuses('2026-12-01')
    await vi.advanceTimersByTimeAsync(2_001)
    expect(await pending).toEqual([])
  })

  it('returns nothing when the database answers with an error', async () => {
    queryMock.mockResolvedValue({ data: null, error: { message: 'paused' } })
    expect(await getActiveTransferBonuses('2026-12-01')).toEqual([])
  })
})
