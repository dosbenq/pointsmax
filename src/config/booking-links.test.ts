import { describe, expect, it } from 'vitest'
import { formatBookingLinksForPrompt, getBookingLinks, getTripBuilderPromptSections } from './booking-links'

describe('booking-links config', () => {
  it('returns only valid URLs', () => {
    const all = getBookingLinks()
    expect(all.length).toBeGreaterThan(10)
    for (const link of all) {
      expect(link.url.startsWith('https://') || link.url.startsWith('http://')).toBe(true)
    }
  })

  it('formats category links for prompt sections', () => {
    const hotels = formatBookingLinksForPrompt('hotel_portal')
    expect(hotels).toContain('World of Hyatt')
    expect(hotels).toContain('Marriott Bonvoy')
  })

  it('builds trip builder prompt sections', () => {
    const sections = getTripBuilderPromptSections()
    expect(sections.hotelBookingUrls).toContain('Known hotel award booking portals')
    expect(sections.bookingStepUrls).toContain('Known portal URLs')
    expect(sections.bookingStepUrls).toContain('Chase UR transfer')
    expect(sections.bookingStepUrls).toContain('United award booking')
  })
})
