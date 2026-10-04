#!/usr/bin/env node
// Validate the catalog and list valuations that are due for a human review.
import { catalog, validateCatalog, findStaleValuations, STALE_AFTER_DAYS } from '../../src/lib/catalog/catalog-core.mjs'

const errors = validateCatalog(catalog)
if (errors.length > 0) {
  console.error('Catalog is invalid:\n' + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(`Catalog OK: ${catalog.programs.length} programmes, ${catalog.valuations.length} valuations, ${catalog.transferPartners.length} transfer routes.`)

const stale = findStaleValuations(catalog)
if (stale.length > 0) {
  console.log(`\nDue for review (older than ${STALE_AFTER_DAYS} days, or placeholders):`)
  for (const s of stale) console.log(`  ${s.program.padEnd(26)} reviewed ${s.reviewed_at} (${s.age_days}d)${s.needs_review ? ' [placeholder]' : ''}`)
}
