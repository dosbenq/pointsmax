import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBookingUrlsForPrompt, getBookingUrl } from './booking-urls'
import * as db from './db/booking-urls'
import type { BookingUrl } from '@/types/database'

vi.mock('./db/booking-urls', () => ({
  getActiveBookingUrls: vi.fn()
}))

describe('booking-urls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBookingUrlsForPrompt', () => {
    it('should use DB source when available (US)', async () => {
      const mockDbUrls: Partial<BookingUrl>[] = [
        { program_slug: 'test-slug', label: 'Test Label', url: 'https://test.com', region: 'us' }
      ]
      vi.mocked(db.getActiveBookingUrls).mockResolvedValue(mockDbUrls as BookingUrl[])

      const result = await getBookingUrlsForPrompt('us')
      expect(result).toContain('Test Label: https://test.com')
      expect(result).not.toContain('Chase UR transfer partners') // Should not have static ones if DB returned data
    })

    it('should use DB source when available (India)', async () => {
      const mockDbUrls: Partial<BookingUrl>[] = [
        { program_slug: 'in-slug', label: 'India Label', url: 'https://india.com', region: 'in' },
        { program_slug: 'global-slug', label: 'Global Label', url: 'https://global.com', region: 'global' }
      ]
      vi.mocked(db.getActiveBookingUrls).mockResolvedValue(mockDbUrls as BookingUrl[])

      const result = await getBookingUrlsForPrompt('in')
      expect(result).toContain('India Label: https://india.com')
      expect(result).toContain('Global Label: https://global.com')
    })

    it('should fallback to static map when DB returns empty', async () => {
      vi.mocked(db.getActiveBookingUrls).mockResolvedValue([])

      const result = await getBookingUrlsForPrompt('us')
      expect(result).toContain('Chase UR transfer partners')
    })

    it('should fallback to static map when DB errors', async () => {
      vi.mocked(db.getActiveBookingUrls).mockRejectedValue(new Error('DB error'))

      const result = await getBookingUrlsForPrompt('us')
      expect(result).toContain('Chase UR transfer partners')
    })

    it('should filter by region correctly for static fallback', async () => {
      vi.mocked(db.getActiveBookingUrls).mockRejectedValue(new Error('DB error'))

      const usResult = await getBookingUrlsForPrompt('us')
      expect(usResult).toContain('Chase UR transfer partners')
      expect(usResult).not.toContain('HDFC Millennia portal')

      const inResult = await getBookingUrlsForPrompt('in')
      expect(inResult).toContain('HDFC Millennia portal')
      expect(inResult).not.toContain('Chase UR transfer partners')
    })
  })

  describe('getBookingUrl', () => {
    it('should return URL from DB if found', async () => {
      const mockDbUrls: Partial<BookingUrl>[] = [
        { program_slug: 'test-slug', url: 'https://db-test.com' }
      ]
      vi.mocked(db.getActiveBookingUrls).mockResolvedValue(mockDbUrls as BookingUrl[])

      const result = await getBookingUrl('test-slug')
      expect(result).toBe('https://db-test.com')
    })

    it('should return URL from static map if not in DB', async () => {
      vi.mocked(db.getActiveBookingUrls).mockResolvedValue([])

      const result = await getBookingUrl('chase-ur')
      expect(result).toBe('https://www.ultimaterewards.com')
    })

    it('should return null for unknown slug', async () => {
      vi.mocked(db.getActiveBookingUrls).mockResolvedValue([])

      const result = await getBookingUrl('non-existent')
      expect(result).toBeNull()
    })

    it('should fallback to static map when DB errors', async () => {
      vi.mocked(db.getActiveBookingUrls).mockRejectedValue(new Error('DB error'))

      const result = await getBookingUrl('chase-ur')
      expect(result).toBe('https://www.ultimaterewards.com')
    })
  })
})
