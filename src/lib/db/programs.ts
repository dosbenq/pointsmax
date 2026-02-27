// ============================================================
// Programs Repository — Sprint 17
// All database access for program-related queries
// Replaces direct Supabase calls in API routes
// ============================================================

import { createPublicClient } from '@/lib/supabase'
import type { Program } from '@/types/database'
import { logError } from '@/lib/logger'

/**
 * Fetch all active programs, optionally filtered by geography
 * Returns programs matching the geography + global programs
 */
export async function getActivePrograms(geography?: 'US' | 'IN' | null): Promise<Program[]> {
  const db = createPublicClient()

  let query = db
    .from('programs')
    .select('id, name, short_name, slug, type, color_hex, geography')
    .eq('is_active', true)
    .order('display_order')

  if (geography) {
    query = query.in('geography', ['global', geography])
  }

  let { data, error } = await query

  // Backward compatibility before geography migration is applied.
  if (error && (error as { code?: string }).code === '42703') {
    const legacy = await db
      .from('programs')
      .select('id, name, short_name, slug, type, color_hex')
      .eq('is_active', true)
      .order('display_order')

    data = (legacy.data ?? []).map((row) => ({ ...row, geography: 'global' }))
    error = legacy.error
  }

  if (error) {
    logError('programs_repository_fetch_failed', { message: error.message })
    throw new Error('Failed to fetch programs')
  }

  return (data ?? []) as unknown as Program[]
}

/**
 * Fetch a single program by its slug
 */
export async function getProgramBySlug(slug: string): Promise<Program | null> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('programs')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    logError('programs_repository_fetch_by_slug_failed', { slug, message: error.message })
    throw new Error('Failed to fetch program')
  }

  return data as unknown as Program
}

/**
 * Fetch programs by their IDs
 */
export async function getProgramsByIds(ids: string[]): Promise<Program[]> {
  if (ids.length === 0) return []

  const db = createPublicClient()

  const { data, error } = await db
    .from('programs')
    .select('*')
    .in('id', ids)
    .eq('is_active', true)
    .order('display_order')

  if (error) {
    logError('programs_repository_fetch_by_ids_failed', { count: ids.length, message: error.message })
    throw new Error('Failed to fetch programs')
  }

  return (data ?? []) as unknown as Program[]
}
