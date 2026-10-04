import { NextResponse } from 'next/server'
import { CATALOG_MANAGED_RESPONSE } from '@/lib/catalog'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

type ProgramRow = {
  id: string
  [key: string]: unknown
}

type LatestValuationRow = {
  program_id: string
  [key: string]: unknown
}

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()

  const [{ data: programs }, { data: valuations }] = await Promise.all([
    db.from('programs').select('*').order('display_order'),
    db.from('latest_valuations').select('*'),
  ])

  const programRows = (programs ?? []) as ProgramRow[]
  const valuationRows = (valuations ?? []) as LatestValuationRow[]

  const result = programRows.map(p => ({
    ...p,
    latest_valuation: valuationRows.find(v => v.program_id === p.id) ?? null,
  }))

  return NextResponse.json({ programs: result })
}

// Valuations are managed in src/data/catalog/valuations.json and synced with
// `npm run catalog:sync`; writing them here would be overwritten on the next sync.
export async function PATCH(request: Request) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authError
  return NextResponse.json(CATALOG_MANAGED_RESPONSE, { status: 409 })
}
