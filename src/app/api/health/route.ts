import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { withTimeout, getActiveQueryCount } from '@/lib/db-timeout'
import { getFeatureStatus } from '@/lib/env-validation'
import { geminiCircuitBreaker, seatsAeroCircuitBreaker } from '@/lib/circuit-breaker'
import { applyApiSecurityHeaders } from '@/lib/security-headers'
import { getMetricsSummary } from '@/lib/telemetry'

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

interface HealthCheck {
  status: HealthStatus
  latency_ms: number
  message?: string
}

interface HealthChecks {
  database: HealthCheck
  features: Record<string, boolean>
  circuit_breakers: Record<string, { state: string; failures: number; successes: number }>
  system: {
    active_queries: number
    memory_usage_mb: number
    uptime_seconds: number
  }
  telemetry: ReturnType<typeof getMetricsSummary>
}

function getMemoryUsageMB(): number {
  if (typeof process.memoryUsage === 'function') {
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  }
  return 0
}

function getUptimeSeconds(): number {
  return Math.round(process.uptime())
}

function determineOverallStatus(checks: HealthChecks): { status: HealthStatus; ok: boolean } {
  // Database is critical
  if (checks.database.status === 'unhealthy') {
    return { status: 'unhealthy', ok: false }
  }

  // Degraded if database is slow or any circuit breaker is open
  if (checks.database.status === 'degraded') {
    return { status: 'degraded', ok: true }
  }

  const hasOpenCircuit = Object.values(checks.circuit_breakers).some(
    cb => cb.state === 'OPEN'
  )
  if (hasOpenCircuit) {
    return { status: 'degraded', ok: true }
  }

  // Degraded if high error rate in AI or queue (arbitrary threshold for demonstration)
  if (checks.telemetry.errors > 50) {
    return { status: 'degraded', ok: true }
  }

  return { status: 'healthy', ok: true }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now()

  // Check authorization for detailed health info
  const healthSecret = process.env.HEALTHCHECK_SECRET?.trim()
  const requestSecret = req.headers.get('x-health-secret')?.trim()
  const isAuthorized =
    process.env.NODE_ENV !== 'production' ||
    (healthSecret && requestSecret && requestSecret === healthSecret)

  // Database health check with timeout
  let dbLatencyMs = 0
  let dbError: string | null = null
  const dbStartTime = Date.now()

  try {
    const db = createAdminClient()
    const result = await withTimeout(
      async () => {
        const { error } = await db.from('programs').select('id').limit(1)
        return error
      },
      { operationName: 'health_check', timeoutMs: 5000 }
    )
    dbLatencyMs = Date.now() - dbStartTime
    if (result) {
      dbError = result.message
    }
  } catch (err) {
    dbLatencyMs = Date.now() - dbStartTime
    dbError = err instanceof Error ? err.message : 'Database check failed'
  }

  const databaseCheck: HealthCheck = {
    status: dbError ? 'unhealthy' : 'healthy',
    latency_ms: dbLatencyMs,
    ...(dbError ? { message: dbError } : {}),
  }

  // Mark as degraded if slow but not failed
  if (!dbError && dbLatencyMs > 1000) {
    databaseCheck.status = 'degraded'
  }

  // Feature status
  const features = getFeatureStatus()

  // Circuit breaker status
  const circuitBreakers = {
    gemini: geminiCircuitBreaker.getState(),
    seats_aero: seatsAeroCircuitBreaker.getState(),
  }

  // System metrics
  const system = {
    active_queries: getActiveQueryCount(),
    memory_usage_mb: getMemoryUsageMB(),
    uptime_seconds: getUptimeSeconds(),
  }

  // Get AI and queue telemetry
  const telemetry = getMetricsSummary()

  const checks: HealthChecks = {
    database: databaseCheck,
    features,
    circuit_breakers: circuitBreakers,
    system,
    telemetry,
  }

  const { status, ok } = determineOverallStatus(checks)

  const response = NextResponse.json(
    {
      ok,
      status,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
      environment: process.env.NODE_ENV ?? 'development',
      region: process.env.VERCEL_REGION ?? 'unknown',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
      ...(isAuthorized ? { checks } : {}),
    },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    },
  )

  // Apply security headers
  return applyApiSecurityHeaders(response)
}

// HEAD for simple health checks (load balancers)
export async function HEAD() {
  const response = new NextResponse(null, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
  return applyApiSecurityHeaders(response)
}
