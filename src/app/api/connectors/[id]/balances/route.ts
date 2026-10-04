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
import { and, desc, eq } from 'drizzle-orm'
import { requireProfile, UUID_RE } from '@/lib/auth-guard'
import { getDb } from '@/lib/db/client'
import { balanceSnapshots, connectedAccounts } from '@/lib/db/schema'

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

  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { userId } = auth

  if (!UUID_RE.test(accountId)) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const db = getDb()
  // Verify account ownership
  const [account] = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
    .limit(1)

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  try {
    const balances = await db
      .select({
        id: balanceSnapshots.id,
        connected_account_id: balanceSnapshots.connectedAccountId,
        user_id: balanceSnapshots.userId,
        program_id: balanceSnapshots.programId,
        balance: balanceSnapshots.balance,
        source: balanceSnapshots.source,
        provider_cursor: balanceSnapshots.providerCursor,
        fetched_at: balanceSnapshots.fetchedAt,
      })
      .from(balanceSnapshots)
      .where(and(eq(balanceSnapshots.connectedAccountId, accountId), eq(balanceSnapshots.userId, userId)))
      .orderBy(desc(balanceSnapshots.fetchedAt))
      .limit(limit)
    return NextResponse.json({ balances })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch balance snapshots' }, { status: 500 })
  }
}
