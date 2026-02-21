import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getEnvSummary } from '@/lib/env'

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const env = getEnvSummary()
  const healthSecret = process.env.HEALTHCHECK_SECRET?.trim()
  const requestSecret = req.headers.get('x-health-secret')?.trim()
  const canViewSensitiveDetails =
    process.env.NODE_ENV !== 'production' ||
    (healthSecret && requestSecret && healthSecret === requestSecret)

  let dbOk = false
  let dbError: string | null = null

  try {
    const db = createAdminClient()
    const { error } = await db.from('programs').select('id', { count: 'exact', head: true })
    if (error) {
      dbError = error.message
    } else {
      dbOk = true
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'Unknown database error'
  }

  const ok = env.requiredMissing.length === 0 && dbOk
  const status = ok ? 200 : 503

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      version:
        process.env.VERCEL_GIT_COMMIT_SHA ??
        process.env.VERCEL_GITHUB_COMMIT_SHA ??
        process.env.npm_package_version ??
        'unknown',
      uptime_seconds: Math.floor(process.uptime()),
      checks: {
        required_env: env.requiredMissing.length === 0,
        database: dbOk,
      },
      details: {
        required_env_missing: canViewSensitiveDetails ? env.requiredMissing : [],
        optional_env_missing: canViewSensitiveDetails ? env.optionalMissing : [],
        db_error: canViewSensitiveDetails ? dbError : null,
      },
      latency_ms: Date.now() - startedAt,
    },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
