import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

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

  // Build base query - join with programs to get geography
  let query = supabase
    .from('user_balances')
    .select(`
      program_id, 
      balance,
      programs!inner(geography)
    `)
    .eq('user_id', userId)

  // If region specified, filter to only include:
  // - Programs with matching geography
  // - Programs with 'global' geography (hotels, airlines shared across regions)
  if (region) {
    query = query.in('programs.geography', [region, 'global'])
  }

  const { data: balances, error } = await query

  if (error) {
    console.error('user_balances_fetch_failed', { user_id: userId, error: error.message })
    return NextResponse.json({ balances: [] })
  }

  // Transform to simple format (remove joined programs data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simplifiedBalances = (balances ?? []).map((b: any) => ({
    program_id: String(b.program_id),
    balance: Number(b.balance),
  }))

  return NextResponse.json({ balances: simplifiedBalances })
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
