import { describe, expect, it, vi } from 'vitest'

const redirect = vi.fn(() => {
  throw new Error('NEXT_REDIRECT')
})

vi.mock('next/navigation', () => ({
  redirect,
}))

const { default: InspirePage } = await import('./page')

describe('Inspire page', () => {
  it('redirects to Planner for US', async () => {
    await expect(
      InspirePage({ params: Promise.resolve({ region: 'us' }) }),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/us/calculator')
  })

  it('redirects to Planner for India', async () => {
    await expect(
      InspirePage({ params: Promise.resolve({ region: 'in' }) }),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/in/calculator')
  })
})
