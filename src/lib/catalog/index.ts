// Typed entry point to the points catalog for app code.
// See catalog-core.mjs for the data model and validation rules.
import {
  catalog,
  convertPointValue,
  findStaleValuations,
  unitForProgram,
  validateCatalog,
  STALE_AFTER_DAYS,
} from './catalog-core.mjs'

export {
  catalog,
  convertPointValue,
  findStaleValuations,
  unitForProgram,
  validateCatalog,
  STALE_AFTER_DAYS,
}

export const CATALOG_MANAGED_RESPONSE = {
  error: 'catalog_managed',
  message:
    'Valuations are managed in src/data/catalog/valuations.json. Edit that file and run `npm run catalog:sync`.',
} as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-04-09" -> "Apr 2026" */
export function formatReviewMonth(isoDate: string): string {
  const [year, month] = isoDate.split('-')
  const name = MONTHS[Number(month) - 1]
  return name && year ? `${name} ${year}` : isoDate
}

/**
 * Human label for the review dates behind a set of valuations,
 * e.g. "Valuations reviewed Apr 2026" or "Valuations reviewed Jan 2025 – Apr 2026".
 */
export function describeValuationReview(dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)).sort()
  if (valid.length === 0) return null
  const oldest = formatReviewMonth(valid[0].slice(0, 10))
  const newest = formatReviewMonth(valid[valid.length - 1].slice(0, 10))
  return oldest === newest ? `Valuations reviewed ${newest}` : `Valuations reviewed ${oldest} – ${newest}`
}

/** The catalog valuation for a programme slug, if any. */
export function getCatalogValuation(slug: string) {
  return catalog.valuations.find((v) => v.program === slug) ?? null
}

/**
 * Valuation table for LLM prompts, scoped to a region (its own programmes plus
 * global ones), so the model quotes the same numbers the calculator uses.
 */
export function formatValuationsForPrompt(region: 'us' | 'in'): string {
  const geography = region === 'in' ? 'IN' : 'US'
  const order = ['transferable_points', 'airline_miles', 'hotel_points', 'cashback']
  const programs = catalog.programs
    .filter((p) => p.is_active && (p.geography === geography || p.geography === 'global'))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.display_order - b.display_order)
  return programs
    .map((p) => {
      const v = getCatalogValuation(p.slug)
      if (!v) return null
      const unit = v.unit === 'paise' ? 'paise per point' : 'cents per point'
      return `  - ${p.name}: ${v.cpp} ${unit} (reviewed ${formatReviewMonth(v.reviewed_at)})`
    })
    .filter((line): line is string => line !== null)
    .join('\n')
}
