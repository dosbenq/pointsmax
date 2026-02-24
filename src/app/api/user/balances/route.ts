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

  // Fetch all user's balances
  const { data: balances, error: balancesError } = await supabase
    .from('user_balances')
    .select('program_id, balance')
    .eq('user_id', userId)

  if (balancesError) {
    console.error('user_balances_fetch_failed', { user_id: userId, error: balancesError.message })
    return NextResponse.json({ balances: [] })
  }

  // If no region filter, return all balances
  if (!region) {
    return NextResponse.json({ balances: balances ?? [] })
  }

  // Fetch programs to filter by geography
  const { data: programs, error: programsError } = await supabase
    .from('programs')
    .select('id, geography')
    .in('geography', [region, 'global'])

  if (programsError) {
    console.error('programs_fetch_failed', { error: programsError.message })
    return NextResponse.json({ balances: balances ?? [] })
  }

  // Create set of valid program IDs for this region
  const validProgramIds = new Set(programs?.map(p => p.id) ?? [])

  // Filter balances to only include programs valid for this region
  const filteredBalances = (balances ?? []).filter(b => validProgramIds.has(b.program_id))

  return NextResponse.json({ balances: filteredBalances })
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
