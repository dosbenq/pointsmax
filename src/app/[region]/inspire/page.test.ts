import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  createServerDbClient: () => ({
    from: () => ({
      select: () => ({
        in: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))

const { default: InspirePage } = await import('./page')

describe('Inspire page', () => {
  it('renders without redirecting for US region', async () => {
    const result = await InspirePage({ params: Promise.resolve({ region: 'us' }) })
    expect(result).toBeDefined()
  })

  it('renders without redirecting for India region', async () => {
    const result = await InspirePage({ params: Promise.resolve({ region: 'in' }) })
    expect(result).toBeDefined()
  })
})
