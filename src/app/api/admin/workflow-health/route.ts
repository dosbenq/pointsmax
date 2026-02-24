import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { logAdminAction, requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase'
import { inngest } from '@/lib/inngest/client'
import { getRequestId, logError, logWarn } from '@/lib/logger'

type ConfigStatus = {
  key: string
  required: boolean
  present: boolean
}

type WatchCountResult = {
  count: number | null
  error: { message: string } | null
}

function configPresence(key: string, required: boolean): ConfigStatus {
  const value = process.env[key]
  return {
    key,
    required,
    present: typeof value === 'string' && value.trim().length > 0,
  }
}

function getConfigStatuses(): ConfigStatus[] {
  return [
    configPresence('GEMINI_API_KEY', true),
    configPresence('INNGEST_EVENT_KEY', true),
    configPresence('INNGEST_SIGNING_KEY', true),
    configPresence('SUPABASE_SERVICE_ROLE_KEY', true),
    configPresence('NEXT_PUBLIC_SUPABASE_URL', true),
    configPresence('SEATS_AERO_API_KEY', false),
    configPresence('RESEND_API_KEY', false),
    configPresence('RESEND_FROM_EMAIL', false),
    configPresence('CRON_SECRET', false),
  ]
}

function mapEventIds(result: unknown): string[] {
  if (!Array.isArray(result)) return []
  return result
    .map((item) => {
      if (!item || typeof item !== 'object' || !('id' in item)) return ''
      const raw = (item as { id?: unknown }).id
      return typeof raw === 'string' ? raw : ''
    })
    .filter(Boolean)
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const authError = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const statuses = getConfigStatuses()
  const required = statuses.filter((status) => status.required)
  const requiredPresent = required.filter((status) => status.present).length

  let totalWatches: number | null = null
  let activeWatches: number | null = null
  let flightWatchesReady = false
  let knowledgeDocsCount: number | null = null
  let knowledgeReady = false
  let dbErrors: string[] = []

  const [totalRes, activeRes, knowledgeRes] = await Promise.all([
    db.from('flight_watches').select('id', { count: 'exact', head: true }),
    db.from('flight_watches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('knowledge_docs').select('id', { count: 'exact', head: true }),
  ])

  const totalResult = totalRes as WatchCountResult
  const activeResult = activeRes as WatchCountResult
  const knowledgeResult = knowledgeRes as WatchCountResult

  if (!totalResult.error && !activeResult.error) {
    flightWatchesReady = true
    totalWatches = totalResult.count ?? 0
    activeWatches = activeResult.count ?? 0
  } else {
    dbErrors = [
      totalResult.error?.message ?? '',
      activeResult.error?.message ?? '',
    ].filter(Boolean)
    logWarn('admin_workflow_health_db_check_failed', {
      requestId,
      errors: dbErrors,
    })
  }

  if (!knowledgeResult.error) {
    knowledgeReady = true
    knowledgeDocsCount = knowledgeResult.count ?? 0
  } else {
    dbErrors = [...dbErrors, knowledgeResult.error.message]
  }

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    configs: statuses,
    summary: {
      required_present: requiredPresent,
      required_total: required.length,
      ready: requiredPresent === required.length && flightWatchesReady,
    },
    db: {
      flight_watches_ready: flightWatchesReady,
      total_watches: totalWatches,
      active_watches: activeWatches,
      knowledge_ready: knowledgeReady,
      knowledge_docs_count: knowledgeDocsCount,
      errors: dbErrors,
    },
    workflow: {
      event_name: 'workflow.healthcheck',
      endpoint: '/api/inngest',
      send_ready: statuses
        .filter((status) => status.required)
        .every((status) => status.present),
    },
  })
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const authError = await requireAdmin(req)
  if (authError) return authError

  const eventKey = process.env.INNGEST_EVENT_KEY?.trim()
  if (!eventKey && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'INNGEST_EVENT_KEY is missing. Configure it before running tests.' },
      { status: 503 },
    )
  }

  const runId = crypto.randomUUID()
  try {
    const sendResult = await inngest.send({
      name: 'workflow.healthcheck',
      data: {
        run_id: runId,
        triggered_by: 'admin_workflow_health',
        triggered_at: new Date().toISOString(),
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      },
    })

    await logAdminAction('workflow.healthcheck_trigger', runId, {
      event_name: 'workflow.healthcheck',
    })

    return NextResponse.json({
      ok: true,
      run_id: runId,
      event_ids: mapEventIds(sendResult),
      message: 'Healthcheck event sent. Verify run status in Inngest dashboard.',
    })
  } catch (error) {
    logError('admin_workflow_health_test_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to send workflow test event' }, { status: 500 })
  }
}
