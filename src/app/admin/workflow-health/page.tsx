'use client'

import { useEffect, useState } from 'react'

type ConfigStatus = {
  key: string
  required: boolean
  present: boolean
}

type HealthPayload = {
  checked_at: string
  configs: ConfigStatus[]
  auth_branding: {
    configured: boolean
    using_supabase_domain: boolean
    message: string
  }
  knowledge_channel: {
    configured: boolean
    url: string | null
    label: string | null
  }
  summary: {
    required_present: number
    required_total: number
    ready: boolean
  }
  db: {
    flight_watches_ready: boolean
    total_watches: number | null
    active_watches: number | null
    knowledge_ready: boolean
    knowledge_docs_count: number | null
    errors: string[]
  }
  workflow: {
    event_name: string
    endpoint: string
    send_ready: boolean
    failed_runs_24h: number
    last_success_at: string | null
  }
}

type TestPayload = {
  ok: boolean
  run_id: string
  event_ids: string[]
  message: string
}

type IngestPayload = {
  ok: boolean
  channel_url: string
  channel_id: string
  enqueued_videos: number
  videos: string[]
  event_ids: string[]
}

export default function AdminWorkflowHealthPage() {
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [error, setError] = useState('')
  const [runningTest, setRunningTest] = useState(false)
  const [testResult, setTestResult] = useState<TestPayload | null>(null)
  const [runningKnowledgeIngest, setRunningKnowledgeIngest] = useState(false)
  const [ingestResult, setIngestResult] = useState<IngestPayload | null>(null)

  async function loadHealth() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/workflow-health')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load workflow health')
      }
      setHealth(data as HealthPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow health')
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  async function runTestEvent() {
    setRunningTest(true)
    setError('')
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/workflow-health', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to run workflow test')
      }
      setTestResult(data as TestPayload)
      await loadHealth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow test')
    } finally {
      setRunningTest(false)
    }
  }

  async function runKnowledgeIngest() {
    setRunningKnowledgeIngest(true)
    setError('')
    setIngestResult(null)
    try {
      const configuredChannelUrl = health?.knowledge_channel.url
      if (!configuredChannelUrl) {
        throw new Error('No default YouTube knowledge channel is configured.')
      }

      const res = await fetch('/api/admin/knowledge/ingest-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_url: configuredChannelUrl,
          max_videos: 15,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to enqueue knowledge ingest')
      }
      setIngestResult(data as IngestPayload)
      await loadHealth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enqueue knowledge ingest')
    } finally {
      setRunningKnowledgeIngest(false)
    }
  }

  useEffect(() => {
    loadHealth()
  }, [])

  const requiredConfigs = (health?.configs ?? []).filter((c) => c.required)
  const optionalConfigs = (health?.configs ?? []).filter((c) => !c.required)
  const authBranding = health?.auth_branding ?? {
    configured: false,
    using_supabase_domain: false,
    message: 'Auth branding status unavailable.',
  }
  const knowledgeChannel = health?.knowledge_channel ?? {
    configured: false,
    url: null,
    label: null,
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workflow Health</h1>
          <p className="text-sm text-slate-500 mt-1">
            Validate workflow configuration and send a one-click end-to-end test event.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadHealth}
            disabled={loading}
            className="text-xs border border-slate-200 bg-white hover:bg-slate-50 rounded-full px-3 py-1.5 text-slate-700 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={runTestEvent}
            disabled={runningTest || loading || !health?.workflow.send_ready}
            className="text-xs bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-full px-4 py-1.5"
          >
            {runningTest ? 'Sending…' : 'Run test event'}
          </button>
          <button
            onClick={runKnowledgeIngest}
            disabled={runningKnowledgeIngest || loading || !knowledgeChannel.configured}
            className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-full px-4 py-1.5"
          >
            {runningKnowledgeIngest ? 'Queuing…' : `Ingest ${knowledgeChannel.label ?? 'channel'}`}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Failed (24h)</p>
          <p className={`text-2xl font-semibold mt-1 ${health?.workflow.failed_runs_24h && health.workflow.failed_runs_24h > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {loading ? '—' : (health?.workflow.failed_runs_24h ?? 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Errors in last 24h
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Last Activity</p>
          <p className="text-sm font-semibold text-slate-900 mt-2 truncate">
            {loading ? '—' : (health?.workflow.last_success_at ? new Date(health.workflow.last_success_at).toLocaleString() : 'Never')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Last successful run
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Required configs</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {loading ? '—' : `${health?.summary.required_present ?? 0}/${health?.summary.required_total ?? 0}`}
          </p>
        </div>
        <div className={`border rounded-xl p-4 ${authBranding.using_supabase_domain ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className="text-xs uppercase tracking-wider text-slate-500">OAuth branding</p>
          <p className={`text-sm font-semibold mt-2 ${authBranding.using_supabase_domain ? 'text-amber-800' : 'text-emerald-800'}`}>
            {loading ? '—' : (authBranding.using_supabase_domain ? 'Supabase domain visible' : 'Custom branded domain')}
          </p>
          <p className={`text-xs mt-1 ${authBranding.using_supabase_domain ? 'text-amber-700' : 'text-emerald-700'}`}>
            {loading ? 'Checking auth domain…' : authBranding.message}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Flight watches</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {loading ? '—' : (health?.db.total_watches ?? 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Active: {loading ? '—' : (health?.db.active_watches ?? 0)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Workflow state</p>
          <p className={`text-sm font-semibold mt-2 ${health?.summary.ready ? 'text-emerald-700' : 'text-amber-700'}`}>
            {loading ? 'Checking…' : (health?.summary.ready ? 'Ready' : 'Needs attention')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Event: {health?.workflow.event_name ?? '—'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:col-span-3">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Knowledge docs</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {loading ? '—' : (health?.db.knowledge_docs_count ?? 0)}
          </p>
          <p className={`text-xs mt-1 ${health?.db.knowledge_ready ? 'text-emerald-700' : 'text-amber-700'}`}>
            {health?.db.knowledge_ready ? 'Knowledge base queryable' : 'Knowledge table missing or inaccessible'}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Required</h2>
        <div className="space-y-2">
          {requiredConfigs.map((cfg) => (
            <div key={cfg.key} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 font-mono">{cfg.key}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.present ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-red-700 border-red-200 bg-red-50'}`}>
                {cfg.present ? 'Present' : 'Missing'}
              </span>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-slate-900 mt-6 mb-3">Optional</h2>
        <div className="space-y-2">
          {optionalConfigs.map((cfg) => (
            <div key={cfg.key} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 font-mono">{cfg.key}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.present ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-slate-500 border-slate-200 bg-slate-50'}`}>
                {cfg.present ? 'Present' : 'Not set'}
              </span>
            </div>
          ))}
        </div>

        {!health?.db.flight_watches_ready && health?.db.errors?.length ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800 font-semibold mb-1">Flight watch DB check failed</p>
            <ul className="text-xs text-amber-700 space-y-1">
              {health.db.errors.map((line, idx) => (
                <li key={`${idx}-${line}`}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-900">One-click test</h2>
        <p className="text-sm text-slate-500 mt-1">
          Sends a `workflow.healthcheck` event through Inngest. Check your Inngest dashboard for the run result.
        </p>
        {testResult ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-800">{testResult.message}</p>
            <p className="text-xs text-emerald-700 mt-1">Run ID: <span className="font-mono">{testResult.run_id}</span></p>
            <p className="text-xs text-emerald-700 mt-1">
              Event IDs: {testResult.event_ids.length ? testResult.event_ids.join(', ') : 'none returned'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-3">No test event sent in this session.</p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-900">Knowledge ingest</h2>
        <p className="text-sm text-slate-500 mt-1">
          {knowledgeChannel.configured
            ? `Queues \`knowledge.ingest_youtube\` for ${knowledgeChannel.label ?? knowledgeChannel.url}.`
            : 'No default YouTube knowledge channel is configured yet.'}
        </p>
        {knowledgeChannel.configured ? (
          <p className="text-xs text-slate-400 mt-2">
            Source: {knowledgeChannel.url}
          </p>
        ) : null}
        {ingestResult ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-800">
              Enqueued {ingestResult.enqueued_videos} videos from {ingestResult.channel_url}
            </p>
            <p className="text-xs text-emerald-700 mt-1">Channel ID: <span className="font-mono">{ingestResult.channel_id}</span></p>
            <p className="text-xs text-emerald-700 mt-1">
              Event IDs: {ingestResult.event_ids.length ? ingestResult.event_ids.join(', ') : 'none returned'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-3">No knowledge ingest queued in this session.</p>
        )}
      </div>
    </div>
  )
}
