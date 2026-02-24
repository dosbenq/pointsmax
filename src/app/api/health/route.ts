import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

type HealthChecks = {
  db: 'ok' | 'missing' | 'error'
  ai: 'ok' | 'missing'
  inngest: 'ok' | 'missing'
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const checks: HealthChecks = {
    db: 'missing',
    ai: hasValue(process.env.GEMINI_API_KEY) ? 'ok' : 'missing',
    inngest: hasValue(process.env.INNGEST_EVENT_KEY) ? 'ok' : 'missing',
  }

  const healthSecret = process.env.HEALTHCHECK_SECRET?.trim()
  const requestSecret = req.headers.get('x-health-secret')?.trim()
  const canViewErrors =
    process.env.NODE_ENV !== 'production' ||
    (healthSecret && requestSecret && requestSecret === healthSecret)

  let dbError: string | null = null
  try {
    const db = createAdminClient()
    const { error } = await db.from('programs').select('id').limit(1)
    if (error) {
      checks.db = 'error'
      dbError = error.message
    } else {
      checks.db = 'ok'
    }
  } catch (err) {
    checks.db = 'error'
    dbError = err instanceof Error ? err.message : 'Unknown database error'
  }

  const ok = checks.db === 'ok' && checks.ai === 'ok' && checks.inngest === 'ok'

  return NextResponse.json(
    {
      ok,
      checks,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
      ...(canViewErrors && dbError ? { error: dbError } : {}),
    },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
