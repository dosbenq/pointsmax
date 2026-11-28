// ============================================================
// Booking URLs Repository
// Booking links are reference data served from the catalog.
// ============================================================

import { getCatalogBookingUrls } from '@/lib/catalog'
import type { BookingUrl } from '@/types/database'

/**
 * Active booking URLs, optionally limited to a region (plus global URLs),
 * in sort order.
 */
export async function getActiveBookingUrls(region?: 'us' | 'in' | null): Promise<BookingUrl[]> {
  return getCatalogBookingUrls()
    .filter((link) => !region || link.region === 'global' || link.region === region)
    .sort((left, right) => left.sort_order - right.sort_order)
}
