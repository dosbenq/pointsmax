import { describe, expect, it } from 'vitest'
import { getActiveBookingUrls } from './booking-urls'

describe('booking-urls repository', () => {
  it('returns every active booking url in sort order when no region is given', async () => {
    const urls = await getActiveBookingUrls()
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every((url) => url.is_active)).toBe(true)
    const orders = urls.map((url) => url.sort_order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('limits a region to its own and global urls', async () => {
    const india = await getActiveBookingUrls('in')
    expect(india.some((url) => url.region === 'in')).toBe(true)
    expect(india.every((url) => url.region === 'in' || url.region === 'global')).toBe(true)
  })
})
