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

  it('filters out invalid URLs from config', () => {
    // Test that all returned URLs are valid HTTP(S) URLs
    const all = getBookingLinks()
    for (const link of all) {
      let parsed: URL
      try {
        parsed = new URL(link.url)
      } catch {
        throw new Error(`Invalid URL for ${link.id}: ${link.url}`)
      }
      expect(parsed.protocol).toMatch(/^https?:$/)
    }
  })

  it('filters by category correctly', () => {
    const hotelLinks = getBookingLinks('hotel_portal')
    const transferLinks = getBookingLinks('transfer_portal')
    const flightLinks = getBookingLinks('flight_booking_portal')

    // Each category should have entries
    expect(hotelLinks.length).toBeGreaterThan(0)
    expect(transferLinks.length).toBeGreaterThan(0)
    expect(flightLinks.length).toBeGreaterThan(0)

    // All returned links should match the requested category
    for (const link of hotelLinks) {
      expect(link.category).toBe('hotel_portal')
    }
    for (const link of transferLinks) {
      expect(link.category).toBe('transfer_portal')
    }
    for (const link of flightLinks) {
      expect(link.category).toBe('flight_booking_portal')
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

  it('trip-builder prompt sections contain only valid URLs', () => {
    const sections = getTripBuilderPromptSections()

    // Extract URLs from the prompt sections using regex
    const urlRegex = /https?:\/\/[^\s\)]+/g
    const hotelUrls = sections.hotelBookingUrls.match(urlRegex) ?? []
    const stepUrls = sections.bookingStepUrls.match(urlRegex) ?? []

    // All extracted URLs should be valid
    for (const url of [...hotelUrls, ...stepUrls]) {
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        throw new Error(`Invalid URL in prompt section: ${url}`)
      }
      expect(parsed.protocol).toMatch(/^https?:$/)
    }

    // Should have URLs from all categories
    expect(hotelUrls.length).toBeGreaterThan(0)
    expect(stepUrls.length).toBeGreaterThan(0)
  })
})
