// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { setDbForTesting } from '@/lib/db/client'
import { userBalances } from '@/lib/db/schema'
import { createTestDb, seedPrograms, seedUser, sessionFor, testId, type SeededUser, type TestDb } from '@/test/utils/test-db'
import { POST } from './route'

vi.mock('@/lib/auth', async (importOriginal) =>
  (await import('@/test/utils/mock-auth')).mockAuthModule(importOriginal))

let db: TestDb
let pat: SeededUser
const confirm = (body: unknown) => POST(new NextRequest('http://localhost/api/connectors/ingest/confirm', {
  method: 'POST',
  body: JSON.stringify(body),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  db = await createTestDb()
  setDbForTesting(db)
  await seedPrograms(db, [{ key: 'chase-ur' }, { key: 'amex-mr' }])
  pat = await seedUser(db, 'pat')
  vi.mocked(getSessionUser).mockResolvedValue(sessionFor(pat))
})

afterAll(() => setDbForTesting(null))

describe('POST /api/connectors/ingest/confirm', () => {
  it('requires authentication', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    expect((await confirm({ candidates: [] })).status).toBe(401)
  })

  it('rejects invalid payloads, including non-UUID programme ids', async () => {
    expect((await confirm({ candidates: [] })).status).toBe(400)
    expect((await confirm({ candidates: [{ program_id: 'chase-ur', balance: 100 }] })).status).toBe(400)
    expect((await confirm({ candidates: [{ program_id: testId('chase-ur'), balance: -5 }] })).status).toBe(400)
  })

  it('upserts selected balances into user_balances for the caller', async () => {
    await db.insert(userBalances).values({ userId: pat.userId, programId: testId('chase-ur'), balance: 1 })

    const res = await confirm({
      candidates: [
        { program_id: testId('chase-ur'), balance: 120000.7 },
        { program_id: testId('amex-mr'), balance: 45000 },
      ],
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, saved_count: 2 })

    const rows = await db.select().from(userBalances)
    expect(rows.map((r) => [r.userId, r.programId, r.balance]).sort()).toEqual([
      [pat.userId, testId('amex-mr'), 45000],
      [pat.userId, testId('chase-ur'), 120000],
    ].sort())
  })
})
