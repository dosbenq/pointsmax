import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatBookingLinksForPrompt,
  getBookingLinks,
  getBookingUrl,
  getBookingUrlsForPrompt,
  getTripBuilderPromptSections,
  isValidBookingUrl,
} from './booking-urls'
import * as db from './db/booking-urls'
import type { BookingUrl } from '@/types/database'

vi.mock('./db/booking-urls', () => ({
  getActiveBookingUrls: vi.fn(),
}))

describe('booking-urls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts only https booking URLs', () => {
    expect(isValidBookingUrl('https://example.com')).toBe(true)
    expect(isValidBookingUrl('http://example.com')).toBe(false)
    expect(isValidBookingUrl('javascript:alert(1)')).toBe(false)
  })

  it('uses DB-backed booking URLs for prompts', async () => {
    const mockDbUrls: BookingUrl[] = [
      {
        id: '1',
        program_slug: 'chase-ur',
        label: 'Chase UR transfer partners',
        url: 'https://www.ultimaterewards.com',
        region: 'us',
        sort_order: 10,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    ]
    vi.mocked(db.getActiveBookingUrls).mockResolvedValue(mockDbUrls)

    const result = await getBookingUrlsForPrompt('us')
    expect(result).toContain('Chase UR transfer partners: https://www.ultimaterewards.com')
  })

  it('fails closed when no DB booking URLs exist', async () => {
    vi.mocked(db.getActiveBookingUrls).mockResolvedValue([])

    const result = await getBookingUrlsForPrompt('us')
    expect(result).toBe('Known booking URLs: none configured. Do not invent external booking links.')
  })

  it('fails closed when booking URL lookup errors', async () => {
    vi.mocked(db.getActiveBookingUrls).mockRejectedValue(new Error('DB error'))

    const result = await getBookingUrlsForPrompt('us')
    expect(result).toBe('Known booking URLs: none configured. Do not invent external booking links.')
  })

  it('normalizes legacy slug aliases when resolving a single URL', async () => {
    vi.mocked(db.getActiveBookingUrls).mockResolvedValue([
      {
        id: '1',
        program_slug: 'citi-thankyou',
        label: 'Citi ThankYou transfer partners',
        url: 'https://www.citi.com/credit-cards/thankyou-rewards',
        region: 'us',
        sort_order: 10,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    ] as BookingUrl[])

    expect(await getBookingUrl('citi-ty')).toBe('https://www.citi.com/credit-cards/thankyou-rewards')
    expect(await getBookingUrl('citi-thankyou')).toBe('https://www.citi.com/credit-cards/thankyou-rewards')
  })

  it('returns null for unknown booking programs', async () => {
    vi.mocked(db.getActiveBookingUrls).mockResolvedValue([])
    expect(await getBookingUrl('non-existent')).toBeNull()
  })

  it('categorizes validated booking links by portal type', async () => {
    vi.mocked(db.getActiveBookingUrls).mockResolvedValue([
      {
        id: '1',
        program_slug: 'hyatt',
        label: 'World of Hyatt',
        url: 'https://world.hyatt.com/content/gp/en/rewards.html',
        region: 'global',
        sort_order: 10,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        program_slug: 'chase-ur',
        label: 'Chase UR transfer partners',
        url: 'https://www.ultimaterewards.com',
        region: 'us',
        sort_order: 20,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        program_slug: 'united',
        label: 'United MileagePlus award search',
        url: 'https://www.united.com/en/us/fly/travel/awards.html',
        region: 'global',
        sort_order: 30,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    ] as BookingUrl[])

    expect((await getBookingLinks('hotel_portal')).map((row) => row.program_slug)).toEqual(['hyatt'])
    expect((await getBookingLinks('transfer_portal')).map((row) => row.program_slug)).toEqual(['chase-ur'])
    expect((await getBookingLinks('flight_booking_portal')).map((row) => row.program_slug)).toEqual(['united'])
  })

  it('formats prompt sections from validated DB records only', async () => {
    vi.mocked(db.getActiveBookingUrls).mockResolvedValue([
      {
        id: '1',
        program_slug: 'hyatt',
        label: 'World of Hyatt',
        url: 'https://world.hyatt.com/content/gp/en/rewards.html',
        region: 'global',
        sort_order: 10,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        program_slug: 'united',
        label: 'United MileagePlus award search',
        url: 'https://www.united.com/en/us/fly/travel/awards.html',
        region: 'global',
        sort_order: 20,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    ] as BookingUrl[])

    const hotels = await formatBookingLinksForPrompt('hotel_portal', 'us')
    const sections = await getTripBuilderPromptSections('us')

    expect(hotels).toContain('World of Hyatt')
    expect(sections.hotelBookingUrls).toContain('Known hotel award booking portals')
    expect(sections.bookingStepUrls).toContain('United MileagePlus award search')
  })
})
