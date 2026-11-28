// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { count } from 'drizzle-orm'
import { createTestDb } from '@/test/utils/test-db'
import { dataImports, flightWatches, userBalances, users } from './schema'
import {
  createSupabaseReader,
  importFromSupabase,
  isSupabaseImportComplete,
  type SupabaseLike,
} from './supabase-import'

type Row = Record<string, unknown>

const ALICE = '11111111-1111-4111-8111-111111111111'
const BOB = '22222222-2222-4222-8222-222222222222'
const GHOST = '99999999-9999-4999-8999-999999999999'
const PROGRAM = '33333333-3333-4333-8333-333333333333'

/** In-memory stand-in for the Supabase REST client: ordering, paging and exact counts. */
function fakeSupabase(tables: Record<string, Row[]>, options: { maxRows?: number; missing?: string[] } = {}): SupabaseLike {
  return {
    from(table) {
      return {
        select: () => ({
          order: (column) => ({
            range: async (from, to) => {
              if (options.missing?.includes(table) || !(table in tables)) {
                return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` }, count: null }
              }
              const sorted = [...tables[table]].sort((a, b) => String(a[column]).localeCompare(String(b[column])))
              const end = Math.min(to + 1, from + (options.maxRows ?? Infinity))
              return { data: sorted.slice(from, end), error: null, count: sorted.length }
            },
          }),
        }),
      }
    },
  }
}

function sourceTables(): Record<string, Row[]> {
  return {
    users: [
      { id: ALICE, email: 'Alice@Example.com', tier: 'premium', stripe_customer_id: 'cus_alice', created_at: '2025-01-01T00:00:00+00:00', auth_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', last_seen_at: '2026-10-01T00:00:00+00:00' },
      { id: BOB, email: 'bob@example.com', tier: 'free', stripe_customer_id: null, created_at: '2025-02-01T00:00:00+00:00', auth_id: null, last_seen_at: '2026-10-02T00:00:00+00:00' },
    ],
    user_preferences: [{ user_id: ALICE, home_airport: 'SFO', preferred_cabin: 'business', preferred_airlines: ['UA'], avoided_airlines: [], updated_at: '2026-01-01T00:00:00+00:00' }],
    user_balances: [
      { id: '44444444-4444-4444-8444-444444444441', user_id: ALICE, program_id: PROGRAM, balance: 120000, updated_at: '2026-01-01T00:00:00+00:00' },
      { id: '44444444-4444-4444-8444-444444444442', user_id: GHOST, program_id: PROGRAM, balance: 5, updated_at: '2026-01-01T00:00:00+00:00' },
    ],
    alert_subscriptions: [{ id: '55555555-5555-4555-8555-555555555555', email: 'news@example.com', user_id: GHOST, program_ids: [PROGRAM], is_active: true, created_at: '2026-01-01T00:00:00+00:00' }],
    flight_watches: [],
    transfer_bonuses: [{ id: '66666666-6666-4666-8666-666666666666', transfer_partner_id: PROGRAM, bonus_pct: 30, start_date: '2026-11-01', end_date: '2026-12-31', is_verified: true, verified: true, active: true, created_at: '2026-11-01T00:00:00+00:00' }],
    affiliate_clicks: [],
    shared_trips: [],
    subscription_events: [],
    stripe_webhook_events: [{ stripe_event_id: 'evt_1', event_type: 'customer.subscription.updated', processed_at: '2026-01-01T00:00:00+00:00', raw_payload: { id: 'evt_1' } }],
  }
}

async function rowCount(db: Awaited<ReturnType<typeof createTestDb>>, table: typeof users | typeof userBalances | typeof dataImports | typeof flightWatches) {
  const [{ total }] = await db.select({ total: count() }).from(table)
  return total
}

describe('importFromSupabase', () => {
  it('rehearses the copy, reports counts, and leaves Neon untouched', async () => {
    const db = await createTestDb()
    const report = await importFromSupabase(db, createSupabaseReader(fakeSupabase(sourceTables())), { dryRun: true })

    expect(report.status).toBe('rehearsed')
    expect(report.duplicateEmails).toBe(0)
    expect(report.tables.users).toEqual({ source: 2, written: 2, skipped: 0 })
    // The balance that points at a user who no longer exists is skipped.
    expect(report.tables.user_balances).toEqual({ source: 2, written: 1, skipped: 1 })
    expect(report.tables.stripe_webhook_events).toEqual({ source: 1, written: 1, skipped: 0 })

    expect(await rowCount(db, users)).toBe(0)
    expect(await rowCount(db, userBalances)).toBe(0)
    expect(await isSupabaseImportComplete(db)).toBe(false)
  })

  it('imports once with original ids, lowercase emails and no old auth ids', async () => {
    const db = await createTestDb()
    const reader = createSupabaseReader(fakeSupabase(sourceTables()))

    const report = await importFromSupabase(db, reader, { dryRun: false })
    expect(report.status).toBe('imported')

    const copied = await db.select().from(users)
    const alice = copied.find((u) => u.id === ALICE)!
    expect(alice).toMatchObject({ email: 'alice@example.com', tier: 'premium', stripeCustomerId: 'cus_alice', authId: null })
    expect(await rowCount(db, userBalances)).toBe(1)
    expect(await isSupabaseImportComplete(db)).toBe(true)

    const again = await importFromSupabase(db, reader, { dryRun: false })
    expect(again.status).toBe('already_imported')
    expect(await rowCount(db, users)).toBe(2)
  })

  it('reads every page when a table is larger than one response', async () => {
    const db = await createTestDb()
    const tables = sourceTables()
    tables.users = Array.from({ length: 7 }, (_, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`,
      email: `user${i}@example.com`,
    }))
    const report = await importFromSupabase(db, createSupabaseReader(fakeSupabase(tables), 3), { dryRun: true })
    expect(report.tables.users).toEqual({ source: 7, written: 7, skipped: 0 })
  })

  it('aborts when Supabase returns fewer rows than it reports', async () => {
    const db = await createTestDb()
    const tables = sourceTables()
    tables.users = Array.from({ length: 5 }, (_, i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, email: `u${i}@example.com` }))
    // Server caps each response at 2 rows while the reader asks for pages of 3.
    const reader = createSupabaseReader(fakeSupabase(tables, { maxRows: 2 }), 3)
    await expect(importFromSupabase(db, reader, { dryRun: true })).rejects.toThrow(/returned 2 rows but Supabase reports 5/)
  })

  it('reports emails that only differ by case and refuses a real import', async () => {
    const db = await createTestDb()
    const tables = sourceTables()
    tables.users.push({ id: '77777777-7777-4777-8777-777777777777', email: 'ALICE@example.com' })
    const reader = createSupabaseReader(fakeSupabase(tables))

    const rehearsal = await importFromSupabase(db, reader, { dryRun: true })
    expect(rehearsal.duplicateEmails).toBe(1)

    await expect(importFromSupabase(db, reader, { dryRun: false })).rejects.toThrow(/differs only by letter case/)
    expect(await rowCount(db, users)).toBe(0)
  })

  it('aborts on any other read error, such as a missing column', async () => {
    const db = await createTestDb()
    const broken: SupabaseLike = {
      from: () => ({
        select: () => ({
          order: () => ({
            range: async () => ({ data: null, error: { code: '42703', message: 'column users.id does not exist' }, count: null }),
          }),
        }),
      }),
    }
    await expect(importFromSupabase(db, createSupabaseReader(broken), { dryRun: true })).rejects.toThrow(/column users.id does not exist/)
  })

  it('treats a table that does not exist in Supabase as empty', async () => {
    const db = await createTestDb()
    const reader = createSupabaseReader(fakeSupabase(sourceTables(), { missing: ['shared_trips'] }))
    const report = await importFromSupabase(db, reader, { dryRun: true })
    expect(report.tables.shared_trips).toEqual({ source: 0, written: 0, skipped: 0, missing: true })
  })
})
