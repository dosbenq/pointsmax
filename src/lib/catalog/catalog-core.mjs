// ============================================================
// PointsMax — Catalog core
// The points catalog (programmes, valuations, transfer partners,
// redemption options) lives in src/data/catalog/*.json and is the
// source of truth. The database is a synced copy (npm run catalog:sync).
//
// Plain ESM so it can be shared by the Next.js app and Node scripts.
// ============================================================

import programs from '../../data/catalog/programs.json' with { type: 'json' }
import valuations from '../../data/catalog/valuations.json' with { type: 'json' }
import transferPartners from '../../data/catalog/transfer-partners.json' with { type: 'json' }
import redemptionOptions from '../../data/catalog/redemption-options.json' with { type: 'json' }
import fx from '../../data/catalog/fx.json' with { type: 'json' }

/** @typedef {'transferable_points' | 'airline_miles' | 'hotel_points' | 'cashback'} ProgramType */
/** @typedef {'US' | 'IN' | 'global'} Geography */

/**
 * @typedef {object} CatalogProgram
 * @property {string} slug
 * @property {string} name
 * @property {string} short_name
 * @property {ProgramType} type
 * @property {string | null} issuer
 * @property {Geography} geography
 * @property {string | null} color_hex
 * @property {number} display_order
 * @property {boolean} is_active
 */

/**
 * @typedef {object} CatalogValuation
 * @property {string} program            programme slug
 * @property {number} cpp                value per point in `unit`
 * @property {'cents' | 'paise'} unit    cents for US/global, paise for IN
 * @property {string} source             e.g. tpg, cardexpert, manual
 * @property {string} [source_url]
 * @property {string} reviewed_at        YYYY-MM-DD the value was last checked by a human
 * @property {string} [notes]
 * @property {boolean} [needs_review]    placeholder value that still needs confirming
 */

/**
 * @typedef {object} CatalogTransferPartner
 * @property {string} from
 * @property {string} to
 * @property {number} ratio_from
 * @property {number} ratio_to
 * @property {number} [min_transfer]
 * @property {number} [transfer_increment]
 * @property {number} transfer_time_min_hrs
 * @property {number} transfer_time_max_hrs
 * @property {boolean} is_instant
 * @property {string} [notes]
 */

/**
 * @typedef {object} CatalogRedemptionOption
 * @property {string} program
 * @property {string} category
 * @property {string} label
 * @property {number} cpp
 * @property {string} [notes]
 */

/**
 * @typedef {object} Catalog
 * @property {CatalogProgram[]} programs
 * @property {CatalogValuation[]} valuations
 * @property {CatalogTransferPartner[]} transferPartners
 * @property {CatalogRedemptionOption[]} redemptionOptions
 */

/** @type {Catalog} */
export const catalog = /** @type {Catalog} */ ({
  programs,
  valuations,
  transferPartners,
  redemptionOptions,
})

export const PROGRAM_TYPES = ['transferable_points', 'airline_miles', 'hotel_points', 'cashback']
export const GEOGRAPHIES = ['US', 'IN', 'global']
export const REDEMPTION_CATEGORIES = [
  'transfer_partner', 'travel_portal', 'statement_credit', 'cashback', 'gift_cards', 'pay_with_points',
]
// Must match the valuation_source enum in the database (see migration 063).
export const VALUATION_SOURCES = ['tpg', 'nerdwallet', 'manual', 'cardexpert', 'technofino']
export const STALE_AFTER_DAYS = 60

// Plausible ranges per unit. Anything outside is almost certainly a unit mistake
// (e.g. ₹1.20 entered as 1.20 instead of 120 paise).
const CPP_RANGE = {
  cents: { min: 0.1, max: 5 },
  paise: { min: 10, max: 300 },
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// 1 US cent expressed in paise (₹88/$ -> 88 paise per cent).
export const PAISE_PER_US_CENT = fx.inr_per_usd

/**
 * Convert a per-point value between units, e.g. a Marriott valuation in cents
 * into paise when the points being transferred are an Indian currency.
 * @param {number} value
 * @param {'cents' | 'paise'} from
 * @param {'cents' | 'paise'} to
 */
export function convertPointValue(value, from, to) {
  if (from === to) return value
  return from === 'cents' ? value * PAISE_PER_US_CENT : value / PAISE_PER_US_CENT
}

/** @param {CatalogProgram} program */
export function unitForProgram(program) {
  return program.geography === 'IN' ? 'paise' : 'cents'
}

/**
 * Validate a catalog. Returns a list of human-readable problems; empty means valid.
 * @param {Catalog} input
 * @param {{ today?: string }} [options]
 * @returns {string[]}
 */
export function validateCatalog(input, options = {}) {
  const errors = []
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const bySlug = new Map()

  for (const p of input.programs) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) errors.push(`programs: invalid slug "${p.slug}"`)
    if (bySlug.has(p.slug)) errors.push(`programs: duplicate slug "${p.slug}"`)
    bySlug.set(p.slug, p)
    if (!p.name || !p.short_name) errors.push(`programs: ${p.slug} is missing name/short_name`)
    if (!PROGRAM_TYPES.includes(p.type)) errors.push(`programs: ${p.slug} has unknown type "${p.type}"`)
    if (!GEOGRAPHIES.includes(p.geography)) errors.push(`programs: ${p.slug} has unknown geography "${p.geography}"`)
  }

  const valued = new Set()
  for (const v of input.valuations) {
    const p = bySlug.get(v.program)
    if (!p) { errors.push(`valuations: unknown programme "${v.program}"`); continue }
    if (valued.has(v.program)) errors.push(`valuations: duplicate entry for "${v.program}"`)
    valued.add(v.program)
    const expectedUnit = unitForProgram(p)
    if (v.unit !== expectedUnit) {
      errors.push(`valuations: ${v.program} must use unit "${expectedUnit}" (got "${v.unit}")`)
    }
    const range = CPP_RANGE[v.unit]
    if (range && (!(typeof v.cpp === 'number') || v.cpp < range.min || v.cpp > range.max)) {
      errors.push(`valuations: ${v.program} cpp ${v.cpp} ${v.unit} is outside the plausible range ${range.min}–${range.max}`)
    }
    if (!VALUATION_SOURCES.includes(v.source)) {
      errors.push(`valuations: ${v.program} has unknown source "${v.source}" (allowed: ${VALUATION_SOURCES.join(', ')})`)
    }
    if (!ISO_DATE.test(v.reviewed_at ?? '')) errors.push(`valuations: ${v.program} reviewed_at must be YYYY-MM-DD`)
    else if (v.reviewed_at > today) errors.push(`valuations: ${v.program} reviewed_at ${v.reviewed_at} is in the future`)
  }
  for (const p of input.programs) {
    if (p.is_active && !valued.has(p.slug)) errors.push(`valuations: active programme "${p.slug}" has no valuation`)
  }

  const routes = new Set()
  for (const t of input.transferPartners) {
    const key = `${t.from}->${t.to}`
    if (!bySlug.has(t.from)) errors.push(`transfer-partners: unknown source programme "${t.from}"`)
    if (!bySlug.has(t.to)) errors.push(`transfer-partners: unknown target programme "${t.to}"`)
    if (t.from === t.to) errors.push(`transfer-partners: ${key} transfers to itself`)
    if (routes.has(key)) errors.push(`transfer-partners: duplicate route ${key}`)
    routes.add(key)
    if (!(t.ratio_from > 0 && t.ratio_to > 0)) errors.push(`transfer-partners: ${key} has a non-positive ratio`)
    if (t.transfer_time_min_hrs > t.transfer_time_max_hrs) errors.push(`transfer-partners: ${key} min time exceeds max time`)
  }

  for (const r of input.redemptionOptions) {
    const p = bySlug.get(r.program)
    if (!p) { errors.push(`redemption-options: unknown programme "${r.program}"`); continue }
    if (!REDEMPTION_CATEGORIES.includes(r.category)) errors.push(`redemption-options: ${r.program} has unknown category "${r.category}"`)
    const range = CPP_RANGE[unitForProgram(p)]
    if (!(r.cpp > 0) || r.cpp > range.max) errors.push(`redemption-options: ${r.program} "${r.label}" cpp ${r.cpp} is implausible`)
  }

  return errors
}

/**
 * Valuations whose reviewed_at is older than `staleAfterDays`, or flagged needs_review.
 * @param {Catalog} input
 * @param {{ today?: string, staleAfterDays?: number }} [options]
 */
export function findStaleValuations(input, options = {}) {
  const today = new Date(`${options.today ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  const limit = options.staleAfterDays ?? STALE_AFTER_DAYS
  return input.valuations
    .map((v) => ({
      program: v.program,
      reviewed_at: v.reviewed_at,
      age_days: Math.floor((today.getTime() - new Date(`${v.reviewed_at}T00:00:00Z`).getTime()) / 86_400_000),
      needs_review: Boolean(v.needs_review),
    }))
    .filter((v) => v.needs_review || v.age_days > limit)
    .sort((a, b) => b.age_days - a.age_days)
}
