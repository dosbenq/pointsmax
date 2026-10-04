import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { loadCatalogHealthReport } from '@/lib/catalog-health-data'
import { logError } from '@/lib/logger'

export async function GET(request: Request) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authError

  try {
    return NextResponse.json({ report: await loadCatalogHealthReport() })
  } catch (error) {
    logError('admin_catalog_health_failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
