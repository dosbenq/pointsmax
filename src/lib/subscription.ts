import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { SubscriptionTier } from '@/types/database'

export type GatedFeature = 'live_award_search' | 'flight_watches'

export async function getUserTier(userId?: string): Promise<SubscriptionTier> {
  try {
    if (userId) {
      const admin = createAdminClient()
      const { data } = await admin
        .from('users')
        .select('tier')
        .eq('id', userId)
        .single()

      return data?.tier === 'premium' ? 'premium' : 'free'
    }

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return 'free'

    const { data } = await supabase
      .from('users')
      .select('tier')
      .eq('auth_id', user.id)
      .single()

    return data?.tier === 'premium' ? 'premium' : 'free'
  } catch {
    return 'free'
  }
}

export function canUseFeature(tier: SubscriptionTier, feature: GatedFeature): boolean {
  switch (feature) {
    case 'live_award_search':
    case 'flight_watches':
      return tier === 'premium'
  }
}
