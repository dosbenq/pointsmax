// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getCatalogProgramBySlug } from '@/lib/catalog'
import { setDbForTesting } from '@/lib/db/client'
import { userBalances } from '@/lib/db/schema'
import { createTestDb, seedUser, sessionFor, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { GET, POST } from './route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))

const CHASE_ID = getCatalogProgramBySlug('chase-ur')!.id
const AIR_INDIA_ID = getCatalogProgramBySlug('air-india')!.id

let db: TestDb
let user: SeededUser

describe('/api/user/balances', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-06T12:00:00.000Z'))
    db = await createTestDb()
    setDbForTesting(db)
    user = await seedUser(db, 'pat')
    vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  afterAll(() => setDbForTesting(null))

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/user/balances'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns saved balances with freshness metadata', async () => {
    await db.insert(userBalances).values({ userId: user.userId, programId: CHASE_ID, balance: 120000, updatedAt: '2026-03-06T11:30:00.000Z' })

    const res = await GET(new NextRequest('http://localhost/api/user/balances'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.balances).toEqual([
      expect.objectContaining({ program_id: CHASE_ID, balance: 120000, source: 'manual', confidence: 'high', is_stale: false }),
    ])
    // ISO 8601, which every browser parses (Postgres' "2026-03-06 11:30:00+00" breaks Safari).
    expect(body.balances[0].as_of).toBe('2026-03-06T11:30:00.000Z')
  })

  it('filters balances by region', async () => {
    await db.insert(userBalances).values([
      { userId: user.userId, programId: CHASE_ID, balance: 120000 },
      { userId: user.userId, programId: AIR_INDIA_ID, balance: 10000 },
    ])

    const res = await GET(new NextRequest('http://localhost/api/user/balances?region=IN'))
    const body = await res.json()
    expect(body.balances.map((b: { program_id: string }) => b.program_id)).toEqual([AIR_INDIA_ID])
  })

  it('saves balances, updating an existing program instead of duplicating it', async () => {
    const save = (balance: number) => POST(new NextRequest('http://localhost/api/user/balances', {
      method: 'POST',
      body: JSON.stringify({ balances: [{ program_id: CHASE_ID, balance }, { program_id: 42, balance: 1 }] }),
    }))

    expect((await save(50000)).status).toBe(200)
    expect((await save(65000)).status).toBe(200)

    expect(await db.select({ programId: userBalances.programId, balance: userBalances.balance }).from(userBalances))
      .toEqual([{ programId: CHASE_ID, balance: 65000 }])
  })

  it('rejects a body without a balances array', async () => {
    const res = await POST(new NextRequest('http://localhost/api/user/balances', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })
})
