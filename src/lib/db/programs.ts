// ============================================================
// Programs Repository
// Programs are reference data served from the catalog (src/data/catalog),
// so these lookups never touch the database.
// ============================================================

import { getCatalogProgramBySlug, getCatalogPrograms } from '@/lib/catalog'
import type { Program } from '@/types/database'

/**
 * Active programs, optionally limited to a geography (plus global programs),
 * in display order.
 */
export async function getActivePrograms(geography?: 'US' | 'IN' | null): Promise<Program[]> {
  return getCatalogPrograms({ geography: geography ?? null })
}

/** A single active program by slug. */
export async function getProgramBySlug(slug: string): Promise<Program | null> {
  const program = getCatalogProgramBySlug(slug)
  return program?.is_active ? program : null
}

/** Active programs for the given ids, in display order. */
export async function getProgramsByIds(ids: string[]): Promise<Program[]> {
  if (ids.length === 0) return []
  const wanted = new Set(ids)
  return getCatalogPrograms().filter((program) => wanted.has(program.id))
}
