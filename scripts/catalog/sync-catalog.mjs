#!/usr/bin/env node
// Sync src/data/catalog/*.json into the database.
//   npm run catalog:sync            # dry run: print the diff
//   npm run catalog:sync -- --apply # write it, in one transaction
import postgres from 'postgres'
import { catalog, validateCatalog, findStaleValuations } from '../../src/lib/catalog/catalog-core.mjs'
import { applyCatalogSync, countChanges, describePlan, planCatalogSync } from './sync-catalog-lib.mjs'
import { getDatabaseUrl } from '../lib/database-url.mjs'

const apply = process.argv.includes('--apply')

const errors = validateCatalog(catalog)
if (errors.length > 0) {
  console.error('Catalog is invalid; fix these before syncing:\n' + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}

const sql = postgres(getDatabaseUrl(), { max: 1, prepare: false, onnotice: () => {} })
const adapter = (client) => ({
  query: (text, params = []) => client.unsafe(text, params),
  transaction: (fn) => client.begin((tx) => fn(adapter(tx))),
})

try {
  const db = adapter(sql)
  const plan = await planCatalogSync(db, catalog)
  const lines = describePlan(plan)
  console.log(lines.length ? lines.join('\n') : 'Database already matches the catalog.')

  const stale = findStaleValuations(catalog)
  if (stale.length > 0) {
    console.log(`\n${stale.length} valuation(s) need a human review (older than 60 days or placeholders):`)
    for (const s of stale) console.log(`  ${s.program.padEnd(26)} reviewed ${s.reviewed_at} (${s.age_days}d)${s.needs_review ? ' [placeholder]' : ''}`)
  }

  const changes = countChanges(plan)
  if (!apply) {
    if (changes > 0) console.log(`\nDry run: ${changes} change(s). Re-run with --apply to write them.`)
  } else if (changes > 0) {
    await applyCatalogSync(db, plan)
    console.log(`\nApplied ${changes} change(s).`)
  }
} finally {
  await sql.end()
}
