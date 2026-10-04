import { sql } from 'drizzle-orm'
import { getOrCreateUserRowId, getSessionUser, getUserRowId } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { userBalances } from '@/lib/db/schema'
import { NextRequest, NextResponse } from 'next/server'
import { loadUnifiedBalancesByUser } from '@/lib/user-balances'

// GET /api/user/balances — returns saved balances for current user
// Query params: ?region=IN|US (optional, filters balances by program geography)
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserRowId(user.id)
  if (!userId) return NextResponse.json({ balances: [] })

  // Get region filter from query params
  const url = new URL(request.url)
  const regionRaw = (url.searchParams.get('region') ?? '').trim().toUpperCase()
  const region = regionRaw === 'US' || regionRaw === 'IN' ? regionRaw : null

  try {
    const balancesByUser = await loadUnifiedBalancesByUser([userId], region)
    return NextResponse.json({ balances: balancesByUser.get(userId) ?? [] })
  } catch (error) {
    console.error('user_unified_balances_fetch_failed', {
      user_id: userId,
      region,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ balances: [] })
  }
}

// POST /api/user/balances — upserts balances for current user
// Body: { balances: [{ program_id: string, balance: number }] }
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
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

  const userId = await getOrCreateUserRowId(user)

  // Upsert each balance
  const rows = balances
    .map((row) => {
      const b = row as { program_id?: unknown; balance?: unknown }
      if (typeof b.program_id !== 'string') return null
      const numericBalance = Number(b.balance)
      if (!Number.isFinite(numericBalance)) return null
      return {
        userId,
        programId: b.program_id,
        balance: numericBalance,
        updatedAt: new Date().toISOString(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid balances provided' }, { status: 400 })
  }

  try {
    await getDb()
      .insert(userBalances)
      .values(rows)
      .onConflictDoUpdate({
        target: [userBalances.userId, userBalances.programId],
        set: { balance: sql`excluded.balance`, updatedAt: sql`excluded.updated_at` },
      })
  } catch (error) {
    console.error('user_balances_upsert_failed', {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
