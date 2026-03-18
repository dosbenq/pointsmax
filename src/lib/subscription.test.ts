import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { canUseFeature, getUserTier, resetSubscriptionTierCache } from './subscription'

vi.mock('@/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

describe('subscription helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSubscriptionTierCache()
  })

  it('returns free when no session exists', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never)

    await expect(getUserTier()).resolves.toBe('free')
  })

  it('returns the stored tier for a known internal user id', async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { tier: 'premium' } }),
          })),
        })),
      })),
    } as never)

    await expect(getUserTier('user-123')).resolves.toBe('premium')
  })

  it('returns free when the lookup throws', async () => {
    vi.mocked(createSupabaseServerClient).mockRejectedValue(new Error('boom'))
    await expect(getUserTier()).resolves.toBe('free')
  })

  it('allows only premium users to access gated features', () => {
    expect(canUseFeature('free', 'live_award_search')).toBe(false)
    expect(canUseFeature('free', 'flight_watches')).toBe(false)
    expect(canUseFeature('free', 'connector_sync')).toBe(false)
    expect(canUseFeature('premium', 'live_award_search')).toBe(true)
    expect(canUseFeature('premium', 'flight_watches')).toBe(true)
    expect(canUseFeature('premium', 'connector_sync')).toBe(true)
  })

  it('caches tier lookups for a known internal user id', async () => {
    const single = vi.fn().mockResolvedValue({ data: { tier: 'premium' } })

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single,
          })),
        })),
      })),
    } as never)

    await expect(getUserTier('user-123')).resolves.toBe('premium')
    await expect(getUserTier('user-123')).resolves.toBe('premium')

    expect(single).toHaveBeenCalledTimes(1)
  })
})
