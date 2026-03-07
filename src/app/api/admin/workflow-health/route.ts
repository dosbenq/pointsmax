import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
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

type AuthBrandingStatus = {
  configured: boolean
  using_supabase_domain: boolean
  message: string
}

type WatchCountResult = {
  count: number | null
  error: { message: string } | null
}

type AuditLogRow = {
  created_at: string
  action: string
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

function getAuthBrandingStatus(): AuthBrandingStatus {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!rawUrl) {
    return {
      configured: false,
      using_supabase_domain: false,
      message: 'NEXT_PUBLIC_SUPABASE_URL is not configured.',
    }
  }

  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase()
    const usingSupabaseDomain = hostname.endsWith('.supabase.co')

    return {
      configured: true,
      using_supabase_domain: usingSupabaseDomain,
      message: usingSupabaseDomain
        ? 'Google OAuth will show a Supabase-hosted domain until Supabase Auth runs behind a custom PointsMax domain.'
        : 'OAuth branding is using a custom auth/app domain.',
    }
  } catch {
    return {
      configured: false,
      using_supabase_domain: false,
      message: 'NEXT_PUBLIC_SUPABASE_URL is invalid.',
    }
  }
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

async function getQueueDepth(): Promise<number> {
  const tasksDir = path.join(process.cwd(), 'agents/tasks')
  try {
    const entries = await fs.readdir(tasksDir)
    const taskFiles = entries.filter((f) => f.startsWith('TASK-') && f.endsWith('.md'))
    let pendingCount = 0
    for (const file of taskFiles) {
      const content = await fs.readFile(path.join(tasksDir, file), 'utf8')
      if (content.includes('status: pending')) {
        pendingCount += 1
      }
    }
    return pendingCount
  } catch {
    // If directory doesn't exist or other error, return 0
    return 0
  }
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const authError = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const statuses = getConfigStatuses()
  const authBranding = getAuthBrandingStatus()
  const required = statuses.filter((status) => status.required)
  const requiredPresent = required.filter((status) => status.present).length

  let totalWatches: number | null = null
  let activeWatches: number | null = null
  let flightWatchesReady = false
  let knowledgeDocsCount: number | null = null
  let knowledgeReady = false
  let dbErrors: string[] = []

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [totalRes, activeRes, knowledgeRes, auditRes, queueDepth] = await Promise.all([
    db.from('flight_watches').select('id', { count: 'exact', head: true }),
    db.from('flight_watches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('knowledge_docs').select('id', { count: 'exact', head: true }),
    db.from('admin_audit_log')
      .select('created_at, action')
      .order('created_at', { ascending: false })
      .limit(200),
    getQueueDepth(),
  ])

  const totalResult = totalRes as WatchCountResult
  const activeResult = activeRes as WatchCountResult
  const knowledgeResult = knowledgeRes as WatchCountResult
  const auditRows: AuditLogRow[] = Array.isArray(auditRes.data)
    ? auditRes.data.filter(
      (row): row is AuditLogRow =>
        !!row
        && typeof row === 'object'
        && typeof (row as { action?: unknown }).action === 'string'
        && typeof (row as { created_at?: unknown }).created_at === 'string',
    )
    : []

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
    dbErrors = [...dbErrors, knowledgeResult.error?.message || 'Unknown knowledge error']
  }

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    configs: statuses,
    auth_branding: authBranding,
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
      queue_depth: queueDepth,
      failed_runs_24h: auditRows.filter((l) =>
        (l.action.toLowerCase().includes('fail') || l.action.toLowerCase().includes('error')) &&
        l.created_at > last24h
      ).length,
      last_success_at: auditRows.find((l) =>
        l.action.includes('trigger') || l.action.includes('success') || l.action.includes('ingest')
      )?.created_at ?? null,
    },
  })
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const authError = await requireAdmin(req)
  if (authError) return authError

  const body = await req.json().catch(() => ({}))

  if (body.action === 'retry') {
    await logAdminAction('workflow.manual_retry', null, {
      triggered_at: new Date().toISOString()
    })
    return NextResponse.json({
      ok: true,
      message: 'Retry action logged. System will re-process eligible failed tasks.'
    })
  }

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
