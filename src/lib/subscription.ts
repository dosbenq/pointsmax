import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'
import type { SubscriptionTier } from '@/types/database'

export type GatedFeature = 'live_award_search' | 'flight_watches' | 'connector_sync'
type TierCacheEntry = { tier: SubscriptionTier; expiresAt: number }

const TIER_CACHE_TTL_MS = 60_000
const tierCache = new Map<string, TierCacheEntry>()

function getCachedTier(cacheKey: string): SubscriptionTier | null {
  const cached = tierCache.get(cacheKey)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    tierCache.delete(cacheKey)
    return null
  }
  return cached.tier
}

function setCachedTier(cacheKey: string, tier: SubscriptionTier) {
  tierCache.set(cacheKey, { tier, expiresAt: Date.now() + TIER_CACHE_TTL_MS })
}

export function resetSubscriptionTierCache() {
  tierCache.clear()
}

export async function getUserTier(userId?: string): Promise<SubscriptionTier> {
  try {
    if (userId) {
      const cached = getCachedTier(`user:${userId}`)
      if (cached) return cached

      const admin = createAdminClient()
      const { data } = await admin
        .from('users')
        .select('tier')
        .eq('id', userId)
        .single()

      const tier = data?.tier === 'premium' ? 'premium' : 'free'
      setCachedTier(`user:${userId}`, tier)
      return tier
    }

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return 'free'

    const cached = getCachedTier(`auth:${user.id}`)
    if (cached) return cached

    const { data } = await supabase
      .from('users')
      .select('tier')
        .eq('auth_id', user.id)
        .single()

    const tier = data?.tier === 'premium' ? 'premium' : 'free'
    setCachedTier(`auth:${user.id}`, tier)
    return tier
  } catch (err) {
    // Safety: fall back to 'free' on error — deny premium access rather than granting it
    logError('get_user_tier_failed', { error: err instanceof Error ? err.message : String(err) })
    return 'free'
  }
}

export function canUseFeature(tier: SubscriptionTier, feature: GatedFeature): boolean {
  switch (feature) {
    case 'live_award_search':
    case 'flight_watches':
    case 'connector_sync':
      return tier === 'premium'
  }
}
