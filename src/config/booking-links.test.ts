import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/booking-urls', () => ({
  formatBookingLinksForPrompt: vi.fn(),
  getBookingLinks: vi.fn(),
  getTripBuilderPromptSections: vi.fn(),
}))

const config = await import('./booking-links')
const lib = await import('@/lib/booking-urls')

describe('booking-links config wrapper', () => {
  it('re-exports booking link helpers from the lib layer', () => {
    expect(config.getBookingLinks).toBe(lib.getBookingLinks)
    expect(config.formatBookingLinksForPrompt).toBe(lib.formatBookingLinksForPrompt)
    expect(config.getTripBuilderPromptSections).toBe(lib.getTripBuilderPromptSections)
  })
})
