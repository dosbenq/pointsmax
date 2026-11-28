import { createServerDbClient } from '@/lib/supabase'
import { logWarn } from '@/lib/logger'
import { withTimeout } from '@/lib/db-timeout'

// Bonuses are an extra on top of the transfer ratios; never make a search wait long for them.
const BONUS_LOOKUP_TIMEOUT_MS = 2_000

export type ActiveTransferBonus = {
  transfer_partner_id: string
  bonus_pct: number
  end_date: string
}

/**
 * Transfer bonuses running today. Only bonuses someone has verified count
 * (the monitor inserts what it detects as unverified). Bonuses are an extra:
 * if the database is unavailable this returns [] rather than failing.
 */
export async function getActiveTransferBonuses(today = new Date().toISOString().slice(0, 10)): Promise<ActiveTransferBonus[]> {
  try {
    return await withTimeout(async () => {
      const { data, error } = await createServerDbClient()
        .from('transfer_bonuses')
        .select('transfer_partner_id, bonus_pct, end_date')
        .eq('is_verified', true)
        .lte('start_date', today)
        .gte('end_date', today)
      if (error) throw new Error(error.message)
      return (data as ActiveTransferBonus[] | null) ?? []
    }, { timeoutMs: BONUS_LOOKUP_TIMEOUT_MS, operationName: 'active_transfer_bonuses' })
  } catch (error) {
    logWarn('active_transfer_bonuses_unavailable', {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}
