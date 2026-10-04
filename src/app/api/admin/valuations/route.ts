import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { CATALOG_MANAGED_RESPONSE } from '@/lib/catalog'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { latestValuations } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  try {
    const valuations = await getDb()
      .select(columnsOf(latestValuations))
      .from(latestValuations)
      .orderBy(asc(latestValuations.programName))
    return NextResponse.json({ valuations })
  } catch (error) {
    logError('admin_valuations_get_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Valuations are managed in src/data/catalog/valuations.json and synced with
// `npm run catalog:sync`; writing them here would be overwritten on the next sync.
export async function POST(request: Request) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authError
  return NextResponse.json(CATALOG_MANAGED_RESPONSE, { status: 409 })
}
