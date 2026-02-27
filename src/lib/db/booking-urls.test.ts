import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getActiveBookingUrls } from './booking-urls'
import { createPublicClient } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  createPublicClient: vi.fn()
}))

describe('booking-urls repository', () => {
  const mockFrom = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockQuery: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((onfulfilled) => {
        return Promise.resolve({ data: [], error: null }).then(onfulfilled)
      })
    }

    mockFrom.mockReturnValue(mockQuery)
    
    vi.mocked(createPublicClient).mockReturnValue({
      from: mockFrom
    } as unknown as ReturnType<typeof createPublicClient>)

    // Helper to set mock data
    mockQuery.setData = (data: unknown, error: unknown = null) => {
      mockQuery.then.mockImplementation((onfulfilled: (value: unknown) => unknown) => {
        return Promise.resolve({ data, error }).then(onfulfilled)
      })
    }
  })

  it('should fetch all active booking urls when no region provided', async () => {
    const mockQuery = mockFrom()
    mockQuery.setData([{ id: '1', label: 'Test', url: 'https://test.com', region: 'global' }])

    const result = await getActiveBookingUrls()

    expect(mockFrom).toHaveBeenCalledWith('booking_urls')
    expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
    expect(mockQuery.order).toHaveBeenCalledWith('sort_order')
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Test')
  })

  it('should filter by region when provided', async () => {
    const mockQuery = mockFrom()
    mockQuery.setData([{ id: '1', label: 'US', url: 'https://us.com', region: 'us' }])

    const result = await getActiveBookingUrls('us')

    expect(mockQuery.in).toHaveBeenCalledWith('region', ['global', 'us'])
    expect(result).toHaveLength(1)
  })

  it('should throw error when DB call fails', async () => {
    const mockQuery = mockFrom()
    mockQuery.setData(null, { message: 'DB Error' })

    await expect(getActiveBookingUrls()).rejects.toThrow('Failed to fetch booking URLs')
  })
})
