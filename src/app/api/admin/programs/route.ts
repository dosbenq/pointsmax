import { NextResponse } from 'next/server'
import { CATALOG_MANAGED_RESPONSE } from '@/lib/catalog'
import { asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { latestValuations, programs as programsTable } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = getDb()
  const [programRows, valuationRows] = await Promise.all([
    db.select(columnsOf(programsTable)).from(programsTable).orderBy(asc(programsTable.displayOrder)),
    db.select(columnsOf(latestValuations)).from(latestValuations),
  ])

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
