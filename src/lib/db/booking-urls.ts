// ============================================================
// Booking URLs Repository
// All database access for booking URL queries
// ============================================================

import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { bookingUrls } from '@/lib/db/schema'
import type { BookingUrl } from '@/types/database'
import { logError } from '@/lib/logger'

/**
 * Fetch all active booking URLs, optionally filtered by region
 * Returns URLs matching the region + global URLs
 */
export async function getActiveBookingUrls(region?: 'us' | 'in' | null): Promise<BookingUrl[]> {
  try {
    const rows = await getDb()
      .select(columnsOf(bookingUrls))
      .from(bookingUrls)
      .where(and(
        eq(bookingUrls.isActive, true),
        region ? inArray(bookingUrls.region, ['global', region]) : undefined,
      ))
      .orderBy(asc(bookingUrls.sortOrder))
    return rows as unknown as BookingUrl[]
  } catch (error) {
    logError('booking_urls_repository_fetch_failed', { message: error instanceof Error ? error.message : String(error) })
    throw new Error('Failed to fetch booking URLs')
  }
}
