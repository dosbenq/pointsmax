import type { SupabaseClient } from '@supabase/supabase-js'
import { SYNC_POLICY } from '@/lib/connectors/sync-orchestrator'
import type { GenericDatabase } from '@/lib/supabase'

type SupabaseLikeClient = {
  from: SupabaseClient<GenericDatabase>['from']
}

type ManualBalanceRow = {
  user_id: string
  program_id: string
  balance: number
  updated_at: string | null
}

type ConnectedAccountRow = {
  id: string
  user_id: string
  status: string | null
  sync_status: string | null
  last_synced_at: string | null
}

type BalanceSnapshotRow = {
  user_id: string
  connected_account_id: string
  program_id: string
  balance: number
  source: 'connector' | 'manual'
  fetched_at: string
}

type ProgramRegionRow = {
  id: string
  geography: string | null
}

export type UnifiedBalance = {
  program_id: string
  balance: number
  source: 'manual' | 'connector'
  as_of: string | null
  confidence: 'high' | 'medium' | 'low'
  sync_status: string | null
  is_stale: boolean
  connected_account_id: string | null
}

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
  return (Date.now() - ts) >= SYNC_POLICY.staleThresholdMs
}

function applyRegionFilter(
  balances: UnifiedBalance[],
  validProgramIds: Set<string> | null,
): UnifiedBalance[] {
  if (!validProgramIds) return balances
  return balances.filter((balance) => validProgramIds.has(balance.program_id))
}

export async function loadUnifiedBalancesByUser(
  client: SupabaseLikeClient,
  userIds: string[],
  region?: 'US' | 'IN' | null,
): Promise<Map<string, UnifiedBalance[]>> {
  const uniqueUserIds = [...new Set(userIds.filter((userId) => typeof userId === 'string' && userId.length > 0))]
  const balancesByUser = new Map<string, UnifiedBalance[]>()

  if (uniqueUserIds.length === 0) return balancesByUser

  const [{ data: manualBalances, error: balancesError }, { data: connectedAccounts, error: connectedAccountsError }, { data: snapshots, error: snapshotsError }] = await Promise.all([
    client
      .from('user_balances')
      .select('user_id, program_id, balance, updated_at')
      .in('user_id', uniqueUserIds),
    client
      .from('connected_accounts')
      .select('id, user_id, status, sync_status, last_synced_at')
      .in('user_id', uniqueUserIds),
    client
      .from('balance_snapshots')
      .select('user_id, connected_account_id, program_id, balance, source, fetched_at')
      .in('user_id', uniqueUserIds)
      .order('fetched_at', { ascending: false }),
  ])

  if (balancesError) throw new Error(`Failed to load manual balances: ${balancesError.message}`)
  if (connectedAccountsError) throw new Error(`Failed to load connected accounts: ${connectedAccountsError.message}`)
  if (snapshotsError) throw new Error(`Failed to load balance snapshots: ${snapshotsError.message}`)

  let validProgramIds: Set<string> | null = null
  if (region) {
    const { data: programs, error: programsError } = await client
      .from('programs')
      .select('id, geography')
      .in('geography', [region, 'global'])

    if (programsError) throw new Error(`Failed to load programs: ${programsError.message}`)

    validProgramIds = new Set(
      (((programs as ProgramRegionRow[] | null) ?? []).map((program) => program.id)),
    )
  }

  const accountMap = new Map<string, ConnectedAccountRow>(
    ((connectedAccounts as ConnectedAccountRow[] | null) ?? []).map((account) => [account.id, account]),
  )

  const unifiedByUser = new Map<string, Map<string, UnifiedBalance>>()
  const getUserBucket = (userId: string) => {
    const existing = unifiedByUser.get(userId)
    if (existing) return existing
    const next = new Map<string, UnifiedBalance>()
    unifiedByUser.set(userId, next)
    return next
  }

  for (const snapshot of (snapshots as BalanceSnapshotRow[] | null) ?? []) {
    const userBucket = getUserBucket(snapshot.user_id)
    if (userBucket.has(snapshot.program_id)) continue

    const account = accountMap.get(snapshot.connected_account_id)
    userBucket.set(snapshot.program_id, {
      program_id: snapshot.program_id,
      balance: snapshot.balance,
      source: 'connector',
      as_of: snapshot.fetched_at,
      confidence: getConfidence(snapshot.fetched_at),
      sync_status: account?.sync_status ?? null,
      is_stale: isStale(snapshot.fetched_at),
      connected_account_id: snapshot.connected_account_id,
    })
  }

  for (const manual of (manualBalances as ManualBalanceRow[] | null) ?? []) {
    const userBucket = getUserBucket(manual.user_id)
    userBucket.set(manual.program_id, {
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

  for (const userId of uniqueUserIds) {
    const userBucket = unifiedByUser.get(userId)
    const balances = userBucket ? Array.from(userBucket.values()) : []
    balancesByUser.set(userId, applyRegionFilter(balances, validProgramIds))
  }

  return balancesByUser
}
