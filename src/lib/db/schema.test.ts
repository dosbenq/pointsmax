// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { createTestDb } from '@/test/utils/test-db'
import { catalog } from '@/lib/catalog'
import { applyCatalogSync, planCatalogSync } from '../../../scripts/catalog/sync-catalog-lib.mjs'

describe('database baseline (db/migrations)', () => {
  it('creates every table and view the app queries, and loads the catalog', async () => {
    const db = await createTestDb()
    const relations = await db.execute<{ name: string }>(sql`
      select table_name as name from information_schema.tables where table_schema = 'public'`)
    const names = new Set(relations.rows.map((r) => r.name))
    for (const required of [
      'programs', 'valuations', 'transfer_partners', 'transfer_bonuses', 'redemption_options', 'cards',
      'card_earning_rates', 'users', 'user_balances', 'user_preferences', 'alert_subscriptions',
      'flight_watches', 'shared_trips', 'booking_guide_sessions', 'booking_guide_steps',
      'connected_accounts', 'balance_snapshots', 'knowledge_docs', 'stripe_webhook_events',
      'latest_valuations', 'active_bonuses', 'site_stats',
      'auth_user', 'auth_session', 'auth_account', 'auth_verification',
    ]) {
      expect(names, required).toContain(required)
    }

    const client = db.$client
    const adapter = {
      query: async (text: string, params: unknown[] = []) => (await client.query(text, params)).rows as never[],
      transaction: (fn: (tx: { query: (t: string, p?: unknown[]) => Promise<never[]> }) => Promise<unknown>) =>
        client.transaction((tx) => fn({ query: async (t, p = []) => (await tx.query(t, p)).rows as never[] })),
    }
    await applyCatalogSync(adapter, await planCatalogSync(adapter, catalog))

    const latest = await db.execute<{ n: number }>(sql`select count(*)::int as n from latest_valuations`)
    expect(latest.rows[0].n).toBe(catalog.valuations.length)
  }, 60_000)

  it('only exposes verified, active bonuses through active_bonuses', async () => {
    const db = await createTestDb()
    await db.$client.exec(`
      insert into programs (id, name, short_name, slug, type) values
        ('00000000-0000-0000-0000-000000000001', 'A', 'A', 'a', 'transferable_points'),
        ('00000000-0000-0000-0000-000000000002', 'B', 'B', 'b', 'airline_miles');
      insert into transfer_partners (id, from_program_id, to_program_id) values
        ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
      insert into transfer_bonuses (transfer_partner_id, bonus_pct, start_date, end_date, is_verified, auto_detected) values
        ('00000000-0000-0000-0000-0000000000aa', 30, current_date - 1, current_date + 7, false, true),
        ('00000000-0000-0000-0000-0000000000aa', 20, current_date - 1, current_date + 7, true, false);
    `)
    const rows = await db.execute<{ bonus_pct: number }>(sql`select bonus_pct from active_bonuses`)
    expect(rows.rows.map((r) => r.bonus_pct)).toEqual([20])
  }, 60_000)
})
