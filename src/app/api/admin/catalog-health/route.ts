import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase'
import { buildCatalogHealthReport } from '@/lib/catalog-health'
import { logError } from '@/lib/logger'

export async function GET(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const db = createAdminClient()
  const [cardsRes, ratesRes] = await Promise.all([
    db.from('cards').select('*').eq('is_active', true).order('name'),
    db.from('card_earning_rates').select('card_id, earn_multiplier'),
  ])

  if (cardsRes.error || ratesRes.error) {
    logError('admin_catalog_health_failed', {
      cards_error: cardsRes.error?.message ?? null,
      rates_error: ratesRes.error?.message ?? null,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const report = buildCatalogHealthReport(
    (cardsRes.data ?? []) as Record<string, unknown>[],
    ((ratesRes.data ?? []) as Array<{ card_id: string; earn_multiplier: number | string | null }>),
  )

  return NextResponse.json({ report })
}
