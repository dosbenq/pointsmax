// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { catalog } from '../../src/lib/catalog/catalog-core.mjs'
import { applyCatalogSync, countChanges, planCatalogSync } from './sync-catalog-lib.mjs'

// Mirrors the production shape of the four catalog tables.
const SCHEMA = `
  CREATE TYPE program_type AS ENUM ('transferable_points', 'airline_miles', 'hotel_points', 'cashback');
  CREATE TYPE redemption_category AS ENUM ('transfer_partner', 'travel_portal', 'statement_credit', 'cashback', 'gift_cards', 'pay_with_points');
  CREATE TYPE valuation_source AS ENUM ('tpg', 'nerdwallet', 'manual', 'cardexpert', 'technofino');
  CREATE TABLE programs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, short_name text NOT NULL,
    slug text NOT NULL UNIQUE, type program_type NOT NULL, issuer text, color_hex text,
    is_active boolean NOT NULL DEFAULT true, display_order int NOT NULL DEFAULT 0,
    geography text DEFAULT 'US', updated_at timestamptz DEFAULT now());
  CREATE TABLE valuations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid NOT NULL REFERENCES programs(id),
    cpp_cents numeric(10,4) NOT NULL, source valuation_source NOT NULL DEFAULT 'manual', source_url text,
    effective_date date NOT NULL DEFAULT CURRENT_DATE, notes text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE UNIQUE INDEX ON valuations (program_id, effective_date, source);
  CREATE VIEW latest_valuations AS
    SELECT DISTINCT ON (program_id) v.*, p.slug AS program_slug FROM valuations v JOIN programs p ON p.id = v.program_id
    ORDER BY program_id, effective_date DESC, created_at DESC;
  CREATE TABLE transfer_partners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_program_id uuid NOT NULL REFERENCES programs(id), to_program_id uuid NOT NULL REFERENCES programs(id),
    ratio_from int NOT NULL DEFAULT 1, ratio_to int NOT NULL DEFAULT 1, min_transfer int NOT NULL DEFAULT 1000,
    transfer_increment int NOT NULL DEFAULT 1000, transfer_time_min_hrs int NOT NULL DEFAULT 0,
    transfer_time_max_hrs int NOT NULL DEFAULT 72, is_instant boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true, notes text, updated_at timestamptz DEFAULT now(),
    UNIQUE (from_program_id, to_program_id));
  CREATE TABLE redemption_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid NOT NULL REFERENCES programs(id),
    category redemption_category NOT NULL, cpp_cents numeric(10,4) NOT NULL, label text NOT NULL, notes text);
`

function adapter(pg: PGlite) {
  const wrap = (client: Pick<PGlite, 'query'>) => ({
    query: async (text: string, params: unknown[] = []) => (await client.query(text, params)).rows as never[],
  })
  return {
    ...wrap(pg),
    transaction: (fn: (tx: ReturnType<typeof wrap>) => Promise<unknown>) => pg.transaction((tx) => fn(wrap(tx))),
  }
}

describe('catalog sync', () => {
  let pg: PGlite

  beforeEach(async () => {
    pg = new PGlite()
    await pg.exec(SCHEMA)
  })

  it('loads an empty database and is then idempotent', async () => {
    const db = adapter(pg)
    const first = await planCatalogSync(db, catalog)
    expect(first.programs.insert).toHaveLength(catalog.programs.length)
    await applyCatalogSync(db, first)

    const second = await planCatalogSync(db, catalog)
    expect(countChanges(second)).toBe(0)

    const { rows } = await pg.query<{ program_slug: string; cpp_cents: string }>(
      `select program_slug, cpp_cents from latest_valuations where program_slug in ('hdfc-smartbuy', 'chase-ur') order by 1`,
    )
    expect(rows.map((r) => [r.program_slug, Number(r.cpp_cents)])).toEqual([['chase-ur', 2.05], ['hdfc-smartbuy', 120]])
  }, 30_000)

  it('makes the catalog value latest, removing newer scraped rows and stale routes', async () => {
    const db = adapter(pg)
    await applyCatalogSync(db, await planCatalogSync(db, catalog))

    // Simulate drift: a scraper wrote a newer (wrong) value, someone added a route, a ratio changed.
    await pg.exec(`
      insert into valuations (program_id, cpp_cents, source, effective_date)
        select id, 1.2, 'cardexpert', '2099-01-01' from programs where slug = 'hdfc-smartbuy';
      insert into transfer_partners (from_program_id, to_program_id)
        select a.id, b.id from programs a, programs b where a.slug = 'chase-ur' and b.slug = 'delta';
      update transfer_partners set ratio_to = 2 where ratio_to = 1 and from_program_id = (select id from programs where slug = 'chase-ur')
        and to_program_id = (select id from programs where slug = 'united');
    `)

    const plan = await planCatalogSync(db, catalog)
    expect(plan.valuations.removeNewer.map((v) => v.slug)).toEqual(['hdfc-smartbuy'])
    expect(plan.transferPartners.deactivate).toEqual(['chase-ur->delta'])
    await applyCatalogSync(db, plan)

    expect(countChanges(await planCatalogSync(db, catalog))).toBe(0)
    const { rows } = await pg.query<{ cpp_cents: string }>(`select cpp_cents from latest_valuations where program_slug = 'hdfc-smartbuy'`)
    expect(Number(rows[0].cpp_cents)).toBe(120)
  }, 30_000)
})
