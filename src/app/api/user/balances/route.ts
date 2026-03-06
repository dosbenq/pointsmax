import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { SYNC_POLICY } from '@/lib/connectors/sync-orchestrator'

type ManualBalanceRow = {
  program_id: string
  balance: number
  updated_at: string | null
}

type ConnectedAccountRow = {
  id: string
  status: string | null
  sync_status: string | null
  last_synced_at: string | null
}

type BalanceSnapshotRow = {
  connected_account_id: string
  program_id: string
  balance: number
  source: 'connector' | 'manual'
  fetched_at: string
}

type UnifiedBalance = {
  program_id: string
  balance: number
  source: 'manual' | 'connector'
  as_of: string | null
  confidence: 'high' | 'medium' | 'low'
  sync_status: string | null
  is_stale: boolean
  connected_account_id: string | null
}

type ProgramRegionRow = {
  id: string
  geography: string | null
}

async function getCurrentUserRowId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authId: string,
): Promise<string | null> {
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .single()

  const id = (userRecord as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : null
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

// GET /api/user/balances — returns saved balances for current user
// Query params: ?region=IN|US (optional, filters balances by program geography)
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getCurrentUserRowId(supabase, user.id)
  if (!userId) return NextResponse.json({ balances: [] })

  // Get region filter from query params
  const url = new URL(request.url)
  const regionRaw = (url.searchParams.get('region') ?? '').trim().toUpperCase()
  const region = regionRaw === 'US' || regionRaw === 'IN' ? regionRaw : null

  const { data: manualBalances, error: balancesError } = await supabase
    .from('user_balances')
    .select('program_id, balance, updated_at')
    .eq('user_id', userId)

  if (balancesError) {
    console.error('user_balances_fetch_failed', { user_id: userId, error: balancesError.message })
    return NextResponse.json({ balances: [] })
  }

  const { data: connectedAccounts, error: connectedAccountsError } = await supabase
    .from('connected_accounts')
    .select('id, status, sync_status, last_synced_at')
    .eq('user_id', userId)

  if (connectedAccountsError) {
    console.error('connected_accounts_fetch_failed', { user_id: userId, error: connectedAccountsError.message })
  }

  const accountMap = new Map<string, ConnectedAccountRow>(
    ((connectedAccounts as ConnectedAccountRow[] | null) ?? []).map((account) => [account.id, account]),
  )

  const { data: snapshots, error: snapshotsError } = await supabase
    .from('balance_snapshots')
    .select('connected_account_id, program_id, balance, source, fetched_at')
    .eq('user_id', userId)
    .order('fetched_at', { ascending: false })

  if (snapshotsError) {
    console.error('balance_snapshots_fetch_failed', { user_id: userId, error: snapshotsError.message })
  }

  let validProgramIds: Set<string> | null = null
  if (region) {
    const { data: programs, error: programsError } = await supabase
      .from('programs')
      .select('id, geography')
      .in('geography', [region, 'global'])

    if (programsError) {
      console.error('programs_fetch_failed', { error: programsError.message })
    } else {
      validProgramIds = new Set(
        (((programs as ProgramRegionRow[] | null) ?? []).map((p) => p.id)),
      )
    }
  }

  const unifiedByProgram = new Map<string, UnifiedBalance>()

  for (const snapshot of (snapshots as BalanceSnapshotRow[] | null) ?? []) {
    if (unifiedByProgram.has(snapshot.program_id)) continue
    const account = accountMap.get(snapshot.connected_account_id)
    unifiedByProgram.set(snapshot.program_id, {
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
    unifiedByProgram.set(manual.program_id, {
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

  const balances = applyRegionFilter(Array.from(unifiedByProgram.values()), validProgramIds)

  return NextResponse.json({ balances })
}

// POST /api/user/balances — upserts balances for current user
// Body: { balances: [{ program_id: string, balance: number }] }
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let parsedBody: unknown
  try {
    parsedBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const balances = (parsedBody as { balances?: unknown })?.balances
  if (!Array.isArray(balances)) {
    return NextResponse.json({ error: 'balances must be an array' }, { status: 400 })
  }

  const userId = await getCurrentUserRowId(supabase, user.id)
  if (!userId) return NextResponse.json({ error: 'User record not found' }, { status: 404 })

  // Upsert each balance
  const rows = balances
    .map((row) => {
      const b = row as { program_id?: unknown; balance?: unknown }
      if (typeof b.program_id !== 'string') return null
      const numericBalance = Number(b.balance)
      if (!Number.isFinite(numericBalance)) return null
      return {
        user_id: userId,
        program_id: b.program_id,
        balance: numericBalance,
        updated_at: new Date().toISOString(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid balances provided' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_balances')
    .upsert(rows, { onConflict: 'user_id,program_id' })

  if (error) {
    console.error('user_balances_upsert_failed', { user_id: userId, error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
