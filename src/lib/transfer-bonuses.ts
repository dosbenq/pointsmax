import { and, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { ensureDatabaseReady } from '@/lib/db/ready'
import { transferBonuses } from '@/lib/db/schema'
import { withTimeout } from '@/lib/db-timeout'
import { logWarn } from '@/lib/logger'

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
      await ensureDatabaseReady()
      return getDb()
        .select({
          transfer_partner_id: transferBonuses.transferPartnerId,
          bonus_pct: transferBonuses.bonusPct,
          end_date: transferBonuses.endDate,
        })
        .from(transferBonuses)
        .where(and(
          eq(transferBonuses.isVerified, true),
          lte(transferBonuses.startDate, today),
          gte(transferBonuses.endDate, today),
        ))
    }, { timeoutMs: BONUS_LOOKUP_TIMEOUT_MS, operationName: 'active_transfer_bonuses' })
  } catch (error) {
    logWarn('active_transfer_bonuses_unavailable', {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}
