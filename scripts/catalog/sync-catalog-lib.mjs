// ============================================================
// Catalog → database sync.
// Makes programs, valuations, transfer_partners and redemption_options
// in the database match src/data/catalog/*.json.
//
// `db` is a minimal adapter so this runs on postgres.js (production) and
// PGlite (tests):
//   db.query(text, params) -> Promise<row[]>
//   db.transaction(fn)     -> Promise<T>, fn receives an adapter with .query
// ============================================================

const num = (v) => (v == null ? null : Number(v))
const sameNumber = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-9

/**
 * Compute the changes needed to make the database match the catalog.
 * @param {{ query: (text: string, params?: unknown[]) => Promise<any[]> }} db
 * @param {import('../../src/lib/catalog/catalog-core.mjs').Catalog} catalog
 */
export async function planCatalogSync(db, catalog) {
  const plan = {
    programs: { insert: [], update: [], notInCatalog: [] },
    valuations: { upsert: [], removeNewer: [] },
    transferPartners: { upsert: [], deactivate: [] },
    redemptionOptions: { replace: [] },
  }

  const dbPrograms = await db.query(
    'select id, slug, name, short_name, type::text as type, issuer, geography, color_hex, display_order, is_active from programs',
  )
  const dbBySlug = new Map(dbPrograms.map((p) => [p.slug, p]))
  const catalogSlugs = new Set(catalog.programs.map((p) => p.slug))

  const programFields = ['name', 'short_name', 'type', 'issuer', 'geography', 'color_hex', 'display_order', 'is_active']
  for (const p of catalog.programs) {
    const existing = dbBySlug.get(p.slug)
    if (!existing) { plan.programs.insert.push(p); continue }
    const changed = programFields.filter((f) => (existing[f] ?? null) !== (p[f] ?? null))
    if (changed.length > 0) plan.programs.update.push({ ...p, changed })
  }
  plan.programs.notInCatalog = dbPrograms.filter((p) => !catalogSlugs.has(p.slug)).map((p) => p.slug)

  // Valuations: the catalog value must be the latest row for each programme.
  const dbValuations = await db.query(
    `select v.id, p.slug, v.cpp_cents, v.source::text as source, v.effective_date::text as effective_date
       from valuations v join programs p on p.id = v.program_id`,
  )
  const valuationsBySlug = new Map()
  for (const row of dbValuations) {
    const list = valuationsBySlug.get(row.slug) ?? []
    list.push(row)
    valuationsBySlug.set(row.slug, list)
  }
  for (const v of catalog.valuations) {
    const rows = valuationsBySlug.get(v.program) ?? []
    const newer = rows.filter((r) => r.effective_date > v.reviewed_at)
    const current = rows.find((r) => r.effective_date === v.reviewed_at && r.source === v.source)
    if (newer.length > 0) plan.valuations.removeNewer.push(...newer.map((r) => ({ ...r, cpp_cents: num(r.cpp_cents) })))
    if (!current || !sameNumber(current.cpp_cents, v.cpp)) {
      plan.valuations.upsert.push({ ...v, previous: current ? num(current.cpp_cents) : null })
    }
  }

  // Transfer partners
  const dbRoutes = await db.query(
    `select f.slug as "from", t.slug as "to", tp.ratio_from, tp.ratio_to, tp.min_transfer, tp.transfer_increment,
            tp.transfer_time_min_hrs, tp.transfer_time_max_hrs, tp.is_instant, tp.is_active, tp.notes
       from transfer_partners tp
       join programs f on f.id = tp.from_program_id
       join programs t on t.id = tp.to_program_id`,
  )
  const routeKey = (r) => `${r.from}->${r.to}`
  const dbRouteMap = new Map(dbRoutes.map((r) => [routeKey(r), r]))
  const catalogRouteKeys = new Set(catalog.transferPartners.map(routeKey))
  for (const t of catalog.transferPartners) {
    const want = normalizeRoute(t)
    const have = dbRouteMap.get(routeKey(t))
    if (!have || !have.is_active || Object.keys(want).some((k) => (have[k] ?? null) !== (want[k] ?? null))) {
      plan.transferPartners.upsert.push(want)
    }
  }
  plan.transferPartners.deactivate = dbRoutes
    .filter((r) => r.is_active && !catalogRouteKeys.has(routeKey(r)))
    .map(routeKey)

  // Redemption options: replace a programme's set when it differs.
  const dbOptions = await db.query(
    `select p.slug as program, ro.category::text as category, ro.label, ro.cpp_cents, ro.notes
       from redemption_options ro join programs p on p.id = ro.program_id`,
  )
  const optionKey = (o) => `${o.category}|${o.label}|${Number(o.cpp ?? o.cpp_cents)}|${o.notes ?? ''}`
  const group = (list) => {
    const m = new Map()
    for (const o of list) m.set(o.program, [...(m.get(o.program) ?? []), optionKey(o)].sort())
    return m
  }
  const dbOptionMap = group(dbOptions)
  const catalogOptionMap = group(catalog.redemptionOptions)
  for (const program of new Set([...dbOptionMap.keys(), ...catalogOptionMap.keys()])) {
    if (!catalogSlugs.has(program)) continue
    const a = JSON.stringify(dbOptionMap.get(program) ?? [])
    const b = JSON.stringify(catalogOptionMap.get(program) ?? [])
    if (a !== b) {
      plan.redemptionOptions.replace.push({
        program,
        options: catalog.redemptionOptions.filter((o) => o.program === program),
      })
    }
  }

  return plan
}

function normalizeRoute(t) {
  return {
    from: t.from,
    to: t.to,
    ratio_from: t.ratio_from,
    ratio_to: t.ratio_to,
    min_transfer: t.min_transfer ?? 1000,
    transfer_increment: t.transfer_increment ?? 1000,
    transfer_time_min_hrs: t.transfer_time_min_hrs,
    transfer_time_max_hrs: t.transfer_time_max_hrs,
    is_instant: t.is_instant,
    notes: t.notes ?? null,
  }
}

export function countChanges(plan) {
  return plan.programs.insert.length
    + plan.programs.update.length
    + plan.valuations.upsert.length
    + plan.valuations.removeNewer.length
    + plan.transferPartners.upsert.length
    + plan.transferPartners.deactivate.length
    + plan.redemptionOptions.replace.length
}

export function describePlan(plan) {
  const lines = []
  for (const p of plan.programs.insert) lines.push(`+ program ${p.slug}`)
  for (const p of plan.programs.update) lines.push(`~ program ${p.slug} (${p.changed.join(', ')})`)
  for (const v of plan.valuations.upsert) {
    const before = v.previous == null ? 'new' : `${v.previous} →`
    lines.push(`~ valuation ${v.program}: ${before} ${v.cpp} ${v.unit} (${v.source}, reviewed ${v.reviewed_at})`)
  }
  for (const v of plan.valuations.removeNewer) {
    lines.push(`- valuation ${v.slug}: drop ${v.cpp_cents} (${v.source}, ${v.effective_date}) — newer than the catalog's review date`)
  }
  for (const t of plan.transferPartners.upsert) lines.push(`~ route ${t.from} → ${t.to} (${t.ratio_from}:${t.ratio_to})`)
  for (const key of plan.transferPartners.deactivate) lines.push(`- route ${key} (deactivated; not in catalog)`)
  for (const r of plan.redemptionOptions.replace) lines.push(`~ redemption options for ${r.program} (${r.options.length})`)
  for (const slug of plan.programs.notInCatalog) lines.push(`! program ${slug} exists in the database but not in the catalog (left untouched)`)
  return lines
}

/**
 * Apply a plan inside one transaction.
 * @param {{ transaction: (fn: (tx: { query: (text: string, params?: unknown[]) => Promise<any[]> }) => Promise<unknown>) => Promise<unknown> }} db
 */
export async function applyCatalogSync(db, plan) {
  await db.transaction(async (tx) => {
    for (const p of plan.programs.insert) {
      await tx.query(
        `insert into programs (slug, name, short_name, type, issuer, geography, color_hex, display_order, is_active)
         values ($1, $2, $3, $4::program_type, $5, $6, $7, $8, $9)`,
        [p.slug, p.name, p.short_name, p.type, p.issuer, p.geography, p.color_hex, p.display_order, p.is_active],
      )
    }
    for (const p of plan.programs.update) {
      await tx.query(
        `update programs set name = $2, short_name = $3, type = $4::program_type, issuer = $5, geography = $6,
                color_hex = $7, display_order = $8, is_active = $9, updated_at = now()
          where slug = $1`,
        [p.slug, p.name, p.short_name, p.type, p.issuer, p.geography, p.color_hex, p.display_order, p.is_active],
      )
    }

    for (const v of plan.valuations.removeNewer) {
      await tx.query('delete from valuations where id = $1', [v.id])
    }
    for (const v of plan.valuations.upsert) {
      const notes = v.needs_review ? `[needs review] ${v.notes ?? ''}`.trim() : (v.notes ?? null)
      const params = [v.program, v.cpp, v.source, v.source_url ?? null, v.reviewed_at, notes]
      const updated = await tx.query(
        `update valuations set cpp_cents = $2, source_url = $4, notes = $6
          where program_id = (select id from programs where slug = $1)
            and source = $3::valuation_source and effective_date = $5::date
         returning id`,
        params,
      )
      if (updated.length === 0) {
        await tx.query(
          `insert into valuations (program_id, cpp_cents, source, source_url, effective_date, notes)
           values ((select id from programs where slug = $1), $2, $3::valuation_source, $4, $5::date, $6)`,
          params,
        )
      }
    }

    for (const t of plan.transferPartners.upsert) {
      const params = [
        t.from, t.to, t.ratio_from, t.ratio_to, t.min_transfer, t.transfer_increment,
        t.transfer_time_min_hrs, t.transfer_time_max_hrs, t.is_instant, t.notes,
      ]
      await tx.query(
        `insert into transfer_partners
           (from_program_id, to_program_id, ratio_from, ratio_to, min_transfer, transfer_increment,
            transfer_time_min_hrs, transfer_time_max_hrs, is_instant, is_active, notes)
         values ((select id from programs where slug = $1), (select id from programs where slug = $2),
                 $3, $4, $5, $6, $7, $8, $9, true, $10)
         on conflict (from_program_id, to_program_id) do update set
           ratio_from = excluded.ratio_from, ratio_to = excluded.ratio_to,
           min_transfer = excluded.min_transfer, transfer_increment = excluded.transfer_increment,
           transfer_time_min_hrs = excluded.transfer_time_min_hrs, transfer_time_max_hrs = excluded.transfer_time_max_hrs,
           is_instant = excluded.is_instant, is_active = true, notes = excluded.notes, updated_at = now()`,
        params,
      )
    }
    for (const key of plan.transferPartners.deactivate) {
      const [from, to] = key.split('->')
      await tx.query(
        `update transfer_partners set is_active = false, updated_at = now()
          where from_program_id = (select id from programs where slug = $1)
            and to_program_id = (select id from programs where slug = $2)`,
        [from, to],
      )
    }

    for (const r of plan.redemptionOptions.replace) {
      await tx.query('delete from redemption_options where program_id = (select id from programs where slug = $1)', [r.program])
      for (const o of r.options) {
        await tx.query(
          `insert into redemption_options (program_id, category, label, cpp_cents, notes)
           values ((select id from programs where slug = $1), $2::redemption_category, $3, $4, $5)`,
          [r.program, o.category, o.label, o.cpp, o.notes ?? null],
        )
      }
    }
  })
}
