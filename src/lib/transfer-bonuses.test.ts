// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDbForTesting } from '@/lib/db/client'
import { ensureDatabaseReady } from '@/lib/db/ready'
import { transferBonuses } from '@/lib/db/schema'
import { createTestDb, type TestDb } from '@/test/utils/test-db'
import { getActiveTransferBonuses } from './transfer-bonuses'

vi.mock('@/lib/logger', () => ({ logWarn: vi.fn(), logError: vi.fn(), logInfo: vi.fn() }))

const TP = '0b5f3c1e-0000-4000-8000-000000000001'
let db: TestDb

beforeEach(async () => {
  db = await createTestDb()
  setDbForTesting(db)
  vi.mocked(ensureDatabaseReady).mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  setDbForTesting(null)
})

describe('getActiveTransferBonuses', () => {
  it('returns only verified bonuses running on the given day', async () => {
    await db.insert(transferBonuses).values([
      { transferPartnerId: TP, bonusPct: 30, startDate: '2026-12-01', endDate: '2026-12-31', isVerified: true },
      { transferPartnerId: TP, bonusPct: 40, startDate: '2026-12-01', endDate: '2026-12-31', isVerified: false },
      { transferPartnerId: TP, bonusPct: 50, startDate: '2026-11-01', endDate: '2026-11-30', isVerified: true },
    ])

    expect(await getActiveTransferBonuses('2026-12-15')).toEqual([{ transfer_partner_id: TP, bonus_pct: 30, end_date: '2026-12-31' }])
  })

  it('gives up after 2 seconds instead of holding up a search', async () => {
    vi.useFakeTimers()
    vi.mocked(ensureDatabaseReady).mockReturnValue(new Promise(() => {}))
    const pending = getActiveTransferBonuses('2026-12-15')
    await vi.advanceTimersByTimeAsync(2_001)
    expect(await pending).toEqual([])
  })

  it('returns nothing while the database is not ready', async () => {
    vi.mocked(ensureDatabaseReady).mockRejectedValue(new Error('not ready'))
    expect(await getActiveTransferBonuses('2026-12-15')).toEqual([])
  })
})
