// ============================================================
// Booking URLs Repository
// All database access for booking URL queries
// ============================================================

import { createPublicClient } from '@/lib/supabase'
import type { BookingUrl } from '@/types/database'
import { logError } from '@/lib/logger'

/**
 * Fetch all active booking URLs, optionally filtered by region
 * Returns URLs matching the region + global URLs
 */
export async function getActiveBookingUrls(region?: 'us' | 'in' | null): Promise<BookingUrl[]> {
  const db = createPublicClient()

  let query = db
    .from('booking_urls')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (region) {
    query = query.in('region', ['global', region])
  }

  const { data, error } = await query

  if (error) {
    logError('booking_urls_repository_fetch_failed', { message: error.message })
    throw new Error('Failed to fetch booking URLs')
  }

  return (data ?? []) as unknown as BookingUrl[]
}
