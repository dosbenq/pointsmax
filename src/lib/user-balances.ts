import type { SupabaseClient } from '@supabase/supabase-js'
import type { GenericDatabase } from '@/lib/supabase'
import { getCatalogPrograms } from '@/lib/catalog'

type SupabaseLikeClient = {
  from: SupabaseClient<GenericDatabase>['from']
}

type ManualBalanceRow = {
  user_id: string
  program_id: string
  balance: number
  updated_at: string | null
}

export type UnifiedBalance = {
  program_id: string
  balance: number
  source: 'manual'
  as_of: string | null
  confidence: 'high' | 'medium' | 'low'
  sync_status: null
  is_stale: boolean
  connected_account_id: null
}

// Balances older than this are flagged so the UI can nudge the user to update them.
const STALE_AFTER_MS = 4 * 60 * 60 * 1000

function getConfidence(asOf: string | null): 'high' | 'medium' | 'low' {
  if (!asOf) return 'low'
  const ts = new Date(asOf).getTime()
  if (Number.isNaN(ts)) return 'low'
  const ageMs = Date.now() - ts
  if (ageMs <= 24 * 60 * 60 * 1000) return 'high'
  if (ageMs <= 72 * 60 * 60 * 1000) return 'medium'
  return 'low'
}

function isStale(asOf: string | null): boolean {
  if (!asOf) return true
  const ts = new Date(asOf).getTime()
  if (Number.isNaN(ts)) return true
  return (Date.now() - ts) >= STALE_AFTER_MS
}

/** Saved (manually entered) balances per user, optionally limited to a region's programs. */
export async function loadUnifiedBalancesByUser(
  client: SupabaseLikeClient,
  userIds: string[],
  region?: 'US' | 'IN' | null,
): Promise<Map<string, UnifiedBalance[]>> {
  const uniqueUserIds = [...new Set(userIds.filter((userId) => typeof userId === 'string' && userId.length > 0))]
  const balancesByUser = new Map<string, UnifiedBalance[]>()

  if (uniqueUserIds.length === 0) return balancesByUser

  const { data: manualBalances, error: balancesError } = await client
    .from('user_balances')
    .select('user_id, program_id, balance, updated_at')
    .in('user_id', uniqueUserIds)

  if (balancesError) throw new Error(`Failed to load manual balances: ${balancesError.message}`)

  const validProgramIds = region
    ? new Set(getCatalogPrograms({ geography: region }).map((program) => program.id))
    : null

  for (const userId of uniqueUserIds) balancesByUser.set(userId, [])

  for (const manual of (manualBalances as ManualBalanceRow[] | null) ?? []) {
    if (validProgramIds && !validProgramIds.has(manual.program_id)) continue
    balancesByUser.get(manual.user_id)?.push({
      program_id: manual.program_id,
      balance: manual.balance,
      source: 'manual',
      as_of: manual.updated_at,
      confidence: getConfidence(manual.updated_at),
      sync_status: null,
      is_stale: isStale(manual.updated_at),
      connected_account_id: null,
    })
  }

  return balancesByUser
}
