import { NextResponse } from 'next/server'
import { CATALOG_MANAGED_RESPONSE } from '@/lib/catalog'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const { data, error } = await db
    .from('latest_valuations')
    .select('*')
    .order('program_name')

  if (error) {
    logError('admin_valuations_get_failed', { error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ valuations: data ?? [] })
}

// Valuations are managed in src/data/catalog/valuations.json and synced with
// `npm run catalog:sync`; writing them here would be overwritten on the next sync.
export async function POST(request: Request) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authError
  return NextResponse.json(CATALOG_MANAGED_RESPONSE, { status: 409 })
}
