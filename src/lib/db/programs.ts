// ============================================================
// Programs Repository
// All database access for program-related queries
// ============================================================

import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { programs } from '@/lib/db/schema'
import type { Program } from '@/types/database'
import { logError } from '@/lib/logger'

/**
 * Fetch all active programs, optionally filtered by geography
 * Returns programs matching the geography + global programs
 */
export async function getActivePrograms(geography?: 'US' | 'IN' | null): Promise<Program[]> {
  try {
    const rows = await getDb()
      .select({
        id: programs.id,
        name: programs.name,
        short_name: programs.shortName,
        slug: programs.slug,
        type: programs.type,
        color_hex: programs.colorHex,
        geography: programs.geography,
      })
      .from(programs)
      .where(and(
        eq(programs.isActive, true),
        geography
          ? or(isNull(programs.geography), eq(programs.geography, geography), eq(programs.geography, 'global'))
          : undefined,
      ))
      .orderBy(asc(programs.displayOrder))
    return rows as unknown as Program[]
  } catch (error) {
    logError('programs_repository_fetch_failed', { message: error instanceof Error ? error.message : String(error) })
    throw new Error('Failed to fetch programs')
  }
}

/**
 * Fetch a single program by its slug
 */
export async function getProgramBySlug(slug: string): Promise<Program | null> {
  try {
    const [row] = await getDb()
      .select(columnsOf(programs))
      .from(programs)
      .where(and(eq(programs.slug, slug), eq(programs.isActive, true)))
      .limit(1)
    return (row ?? null) as unknown as Program | null
  } catch (error) {
    logError('programs_repository_fetch_by_slug_failed', { slug, message: error instanceof Error ? error.message : String(error) })
    throw new Error('Failed to fetch program')
  }
}

/**
 * Fetch programs by their IDs
 */
export async function getProgramsByIds(ids: string[]): Promise<Program[]> {
  if (ids.length === 0) return []

  try {
    const rows = await getDb()
      .select(columnsOf(programs))
      .from(programs)
      .where(and(inArray(programs.id, ids), eq(programs.isActive, true)))
      .orderBy(asc(programs.displayOrder))
    return rows as unknown as Program[]
  } catch (error) {
    logError('programs_repository_fetch_by_ids_failed', { count: ids.length, message: error instanceof Error ? error.message : String(error) })
    throw new Error('Failed to fetch programs')
  }
}
