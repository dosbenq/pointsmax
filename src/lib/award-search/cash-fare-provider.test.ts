// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { fetchCashFareUsd } from './cash-fare-provider'
import { setDbForTesting } from '@/lib/db/client'
import { createTestDb, type TestDb } from '@/test/utils/test-db'

let db: TestDb

function stubSerpApi(price: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ best_flights: [{ price }] }),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchCashFareUsd', () => {
  const originalKey = process.env.SERPAPI_KEY

  beforeEach(async () => {
    process.env.SERPAPI_KEY = 'serp_test'
    db = await createTestDb()
    setDbForTesting(db)
  })

  afterEach(() => {
    process.env.SERPAPI_KEY = originalKey
    vi.unstubAllGlobals()
  })

  afterAll(() => setDbForTesting(null))

  it('returns null when the API key is missing', async () => {
    delete process.env.SERPAPI_KEY
    await expect(fetchCashFareUsd('JFK', 'LHR', 'business', '2026-04-01')).resolves.toBeNull()
  })

  it('stores a fetched fare and serves the next lookup from the cache', async () => {
    const fetchMock = stubSerpApi('$1,876')
    await expect(fetchCashFareUsd('JFK', 'LHR', 'business', '2026-04-01')).resolves.toBe(1876)
    await expect(fetchCashFareUsd('JFK', 'LHR', 'business', '2026-04-01')).resolves.toBe(1876)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches and overwrites a stale cache row', async () => {
    stubSerpApi('$999')
    await fetchCashFareUsd('JFK', 'LHR', 'business', '2026-04-01')
    await db.execute(sql`update cash_fare_cache set fetched_at = '2020-01-01T00:00:00Z'`)

    const fetchMock = stubSerpApi('$1,234')
    await expect(fetchCashFareUsd('JFK', 'LHR', 'business', '2026-04-01')).resolves.toBe(1234)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const rows = await db.execute<{ fare_usd: number }>(sql`select fare_usd from cash_fare_cache`)
    expect(rows.rows).toEqual([{ fare_usd: 1234 }])
  })

  it('still returns a fare when the cache is unavailable', async () => {
    await db.execute(sql`drop table cash_fare_cache`)
    stubSerpApi('$500')
    await expect(fetchCashFareUsd('JFK', 'LHR', 'economy', '2026-04-01')).resolves.toBe(500)
  })
})
