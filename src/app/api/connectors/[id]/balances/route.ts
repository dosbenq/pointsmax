// ============================================================
// GET /api/connectors/[id]/balances
//
// Returns balance snapshots for a connected account.
// Used by the ConnectedWallets component to show current balance
// with source and confidence information.
//
// Query params:
//   - limit: number (default 10, max 100)
//
// Response:
//   200 { balances: BalanceSnapshot[] }
//   401 { error: string } — not authenticated
//   403 { error: string } — account not owned by user
//   404 { error: string } — account not found
//   500 { error: string } — internal failure
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params
  const { searchParams } = new URL(req.url)
  const limitParam = searchParams.get('limit')
  const limit = Math.min(Math.max(parseInt(limitParam || '10', 10), 1), 100)

  if (!accountId || accountId.trim() === '') {
    return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve internal user row id
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  const userId = (userRow as { id?: string } | null)?.id
  if (!userId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 404 })
  }

  // Verify account ownership
  const { data: account, error: accountErr } = await supabase
    .from('connected_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (accountErr || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Fetch balance snapshots
  const { data: balances, error } = await supabase
    .from('balance_snapshots')
    .select('id, connected_account_id, user_id, program_id, balance, source, provider_cursor, fetched_at')
    .eq('connected_account_id', accountId)
    .eq('user_id', userId)
    .order('fetched_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch balance snapshots' }, { status: 500 })
  }

  return NextResponse.json({ balances: balances ?? [] })
}
