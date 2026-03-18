'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ConnectedAccount, ConnectorProvider, BalanceSnapshotSource } from '@/types/connectors'

// Balance info from latest snapshot
type BalanceInfo = {
  balance: number
  source: BalanceSnapshotSource
  fetchedAt: string
  confidence: 'high' | 'medium' | 'low'
}

type LoadingState = { type: 'loading' }
type ErrorState = { type: 'error'; message: string }
type EmptyState = { type: 'empty' }
type ConnectedState = { type: 'connected'; accounts: ConnectedAccount[]; balances: Record<string, BalanceInfo> }

type ViewState = LoadingState | ErrorState | EmptyState | ConnectedState
type ImportProgramOption = { id: string; name: string; type: string }
type ImportReviewCandidate = {
  id: string
  source: 'csv' | 'statement' | 'pdf'
  label: string
  balance: number
  program_id: string | null
  program_matched_name: string | null
  confidence: 'exact' | 'alias' | 'fuzzy' | null
  selected: boolean
}

const PROVIDER_DISPLAY_NAMES: Record<ConnectorProvider, string> = {
  amex: 'American Express',
  chase: 'Chase',
  citi: 'Citi',
  bilt: 'Bilt',
  capital_one: 'Capital One',
  wells_fargo: 'Wells Fargo',
  bank_of_america: 'Bank of America',
  us_bank: 'U.S. Bank',
  discover: 'Discover',
  barclays: 'Barclays',
}

const PROVIDER_ICONS: Record<ConnectorProvider, string> = {
  amex: '💳',
  chase: '🏦',
  citi: '🏛️',
  bilt: '🏠',
  capital_one: '💰',
  wells_fargo: '🐎',
  bank_of_america: '🏛️',
  us_bank: '🏦',
  discover: '🧭',
  barclays: '🇬🇧',
}

const CSV_TEMPLATES = [
  {
    key: 'generic',
    label: 'Generic template',
    fileName: 'pointsmax-balances-template.csv',
    instruction: 'Use columns: Program,Balance. Example: Chase UR,100000',
    csv: 'Program,Balance,Notes\nChase UR,100000,Primary transferable balance\nAmex MR,50000,Keep values as whole numbers\n',
  },
  {
    key: 'chase',
    label: 'Chase-style template',
    fileName: 'pointsmax-chase-template.csv',
    instruction: 'Map Chase export columns like Program and Points Balance into Program,Balance before upload.',
    csv: 'Program,Balance,Notes\nChase Ultimate Rewards,100000,Example Chase points balance\nUnited MileagePlus,42000,If present in the same export\n',
  },
  {
    key: 'amex',
    label: 'Amex-style template',
    fileName: 'pointsmax-amex-template.csv',
    instruction: 'Map Membership Rewards balances into Program,Balance. Keep the balance numeric only.',
    csv: 'Program,Balance,Notes\nAmex MR,85000,Example Amex Membership Rewards balance\nHilton Honors,120000,Optional if your export includes partner balances\n',
  },
] as const

function buildReviewCandidates(
  source: 'csv' | 'statement' | 'pdf',
  rows: Array<{
    raw_line?: string
    program_name?: string
    program_hint?: string
    balance: number
    program_id: string | null
    program_matched_name: string | null
    confidence: 'exact' | 'alias' | 'fuzzy' | null
  }>,
): ImportReviewCandidate[] {
  return rows.map((row, index) => ({
    id: `${source}-${index}-${row.program_id ?? 'unmatched'}`,
    source,
    label: row.raw_line ?? row.program_name ?? row.program_hint ?? 'Imported balance',
    balance: row.balance,
    program_id: row.program_id,
    program_matched_name: row.program_matched_name,
    confidence: row.confidence,
    selected: row.program_id !== null,
  }))
}

function buildCsvTemplateUrl(csv: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
}

function getStatusBadgeClass(status: ConnectedAccount['status']): string {
  switch (status) {
    case 'active':
      return 'bg-pm-success-soft text-pm-success border-pm-success-border'
    case 'expired':
    case 'error':
      return 'bg-pm-danger-soft text-pm-danger border-pm-danger-border'
    case 'revoked':
      return 'bg-pm-warning-soft text-pm-warning border-pm-warning-border'
    default:
      return 'bg-pm-surface-soft text-pm-ink-500 border-pm-border'
  }
}

function getSyncStatusBadgeClass(syncStatus: ConnectedAccount['sync_status']): string {
  switch (syncStatus) {
    case 'ok':
      return 'text-pm-success'
    case 'syncing':
      return 'text-pm-accent'
    case 'error':
    case 'stale':
      return 'text-pm-danger'
    case 'pending':
    default:
      return 'text-pm-ink-500'
  }
}

function getSourceBadgeClass(source: BalanceSnapshotSource): string {
  switch (source) {
    case 'connector':
      return 'bg-pm-accent-soft text-pm-accent border-pm-accent-border'
    case 'manual':
      return 'bg-pm-surface-soft text-pm-ink-500 border-pm-border'
    default:
      return 'bg-pm-surface-soft text-pm-ink-500 border-pm-border'
  }
}

function getConfidenceBadgeClass(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return 'bg-pm-success-soft text-pm-success border-pm-success-border'
    case 'medium':
      return 'bg-pm-warning-soft text-pm-warning border-pm-warning-border'
    case 'low':
      return 'bg-pm-danger-soft text-pm-danger border-pm-danger-border'
    default:
      return 'bg-pm-surface-soft text-pm-ink-500 border-pm-border'
  }
}

function formatLastSynced(date: string | null): string {
  if (!date) return 'Never synced'
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

interface ConnectedWalletsProps {
  /** Callback when user chooses to enter balance manually */
  onManualEntry?: () => void
  /** Optional CSS class for the container */
  className?: string
  /** Whether the user is a guest (hides sync features) */
  isGuest?: boolean
}

export function ConnectedWallets({ onManualEntry, className = '', isGuest = false }: ConnectedWalletsProps) {
  const [viewState, setViewState] = useState<ViewState>({ type: 'loading' })
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<(typeof CSV_TEMPLATES)[number]['key']>('generic')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvStatus, setCsvStatus] = useState<string | null>(null)
  const [statementText, setStatementText] = useState('')
  const [statementImporting, setStatementImporting] = useState(false)
  const [statementStatus, setStatementStatus] = useState<string | null>(null)
  const [pdfImporting, setPdfImporting] = useState(false)
  const [pdfStatus, setPdfStatus] = useState<string | null>(null)
  const [confirmSaving, setConfirmSaving] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null)
  const [reviewCandidates, setReviewCandidates] = useState<ImportReviewCandidate[]>([])
  const [reviewSource, setReviewSource] = useState<'csv' | 'statement' | 'pdf' | null>(null)
  const [importPrograms, setImportPrograms] = useState<ImportProgramOption[]>([])
  const csvImportSectionRef = useRef<HTMLDivElement | null>(null)

  const selectedTemplate = CSV_TEMPLATES.find((template) => template.key === selectedTemplateKey) ?? CSV_TEMPLATES[0]

  const fetchAccounts = useCallback(async () => {
    if (isGuest) {
      setViewState({ type: 'empty' })
      return
    }

    try {
      const res = await fetch('/api/connectors')
      if (!res.ok) {
        if (res.status === 401) {
          setViewState({ type: 'error', message: 'Please sign in to manage connected wallets.' })
        } else {
          setViewState({ type: 'error', message: 'Failed to load connected wallets. Please try again.' })
        }
        return
      }
      const data = await res.json()
      const accounts = data.accounts as ConnectedAccount[]
      
      // Fetch balance snapshots for each account
      const balances: Record<string, BalanceInfo> = {}
      await Promise.all(
        accounts.map(async (account) => {
          try {
            const balanceRes = await fetch(`/api/connectors/${account.id}/balances?limit=1`)
            if (balanceRes.ok) {
              const balanceData = await balanceRes.json()
              const latest = balanceData.balances?.[0]
              if (latest) {
                // Calculate confidence based on age
                const fetchedAt = new Date(latest.fetched_at)
                const ageHours = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60)
                const confidence = ageHours < 24 ? 'high' : ageHours < 72 ? 'medium' : 'low'
                
                balances[account.id] = {
                  balance: latest.balance,
                  source: latest.source,
                  fetchedAt: latest.fetched_at,
                  confidence,
                }
              }
            }
          } catch {
            // Silently skip failed balance fetches
          }
        })
      )
      
      if (accounts.length === 0) {
        setViewState({ type: 'empty' })
      } else {
        setViewState({ type: 'connected', accounts, balances })
      }
    } catch {
      setViewState({ type: 'error', message: 'Failed to load connected wallets. Please try again.' })
    }
  }, [isGuest])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetch('/api/programs', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data) => {
        setImportPrograms(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        setImportPrograms([])
      })
  }, [])

  const handleSync = async (accountId: string) => {
    setActionLoading(prev => ({ ...prev, [accountId]: true }))
    try {
      const res = await fetch('/api/connectors/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      })
      const result = await res.json()
      
      if (!res.ok) {
        throw new Error(result.error || 'Sync failed')
      }
      
      // Refresh accounts to show updated sync status
      await fetchAccounts()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      // Update the account's error state locally for immediate feedback
      if (viewState.type === 'connected') {
        setViewState({
          type: 'connected',
          accounts: viewState.accounts.map(a =>
            a.id === accountId
              ? { ...a, sync_status: 'error' as const, last_error: message }
              : a
          ),
          balances: viewState.balances,
        })
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [accountId]: false }))
    }
  }

  const handleDisconnect = async (accountId: string) => {
    setActionLoading(prev => ({ ...prev, [accountId]: true }))
    try {
      const res = await fetch('/api/connectors/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      })
      
      if (!res.ok) {
        const result = await res.json().catch(() => ({}))
        throw new Error(result.error || 'Disconnect failed')
      }
      
      // Refresh accounts list
      await fetchAccounts()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Disconnect failed'
      alert(message)
    } finally {
      setActionLoading(prev => ({ ...prev, [accountId]: false }))
    }
  }

  const handleDelete = async (accountId: string) => {
    setActionLoading(prev => ({ ...prev, [accountId]: true }))
    try {
      const res = await fetch(`/api/connectors/${accountId}`, {
        method: 'DELETE',
      })
      
      if (!res.ok) {
        const result = await res.json().catch(() => ({}))
        throw new Error(result.error || 'Delete failed')
      }
      
      setShowDeleteConfirm(null)
      // Refresh accounts list
      await fetchAccounts()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      alert(message)
    } finally {
      setActionLoading(prev => ({ ...prev, [accountId]: false }))
    }
  }

  const focusImportSection = () => {
    csvImportSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const handleConnect = () => {
    focusImportSection()
  }

  const handleCsvImport = async () => {
    if (!selectedFile) {
      setCsvStatus('Choose a CSV file before importing.')
      return
    }

    setCsvImporting(true)
    setCsvStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('previewOnly', 'true')

      const response = await fetch('/api/connectors/ingest/csv', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json().catch(() => ({})) as {
        error?: string
        matched_rows?: Array<{
          program_name: string
          balance: number
          program_id: string | null
          program_matched_name: string | null
          confidence: 'exact' | 'alias' | 'fuzzy' | null
        }>
        unmatched_rows?: Array<{
          program_name: string
          balance: number
          program_id: string | null
          program_matched_name: string | null
          confidence: 'exact' | 'alias' | 'fuzzy' | null
        }>
        warnings?: string[]
      }

      if (!response.ok) {
        throw new Error(payload.error || 'CSV import failed')
      }

      const candidates = buildReviewCandidates('csv', [
        ...(payload.matched_rows ?? []),
        ...(payload.unmatched_rows ?? []),
      ])
      setReviewCandidates(candidates)
      setReviewSource('csv')
      setCsvStatus(`Review ${candidates.length} imported row${candidates.length === 1 ? '' : 's'} before saving.`)
      setConfirmStatus(null)
      setSelectedFile(null)
    } catch (error) {
      setCsvStatus(error instanceof Error ? error.message : 'CSV import failed')
    } finally {
      setCsvImporting(false)
    }
  }

  const handleStatementImport = async () => {
    if (!statementText.trim()) {
      setStatementStatus('Paste statement text before analyzing.')
      return
    }

    setStatementImporting(true)
    setStatementStatus(null)

    try {
      const response = await fetch('/api/connectors/ingest/statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: statementText }),
      })
      const payload = await response.json().catch(() => ({})) as {
        error?: { message?: string } | string
        candidates?: Array<{
          raw_line: string
          balance: number
          program_id: string | null
          program_matched_name: string | null
          confidence: 'exact' | 'alias' | 'fuzzy' | null
        }>
      }
      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Statement import failed')
      }

      const candidates = buildReviewCandidates('statement', payload.candidates ?? [])
      setReviewCandidates(candidates)
      setReviewSource('statement')
      setStatementStatus(`Review ${candidates.length} detected balance${candidates.length === 1 ? '' : 's'} before saving.`)
      setConfirmStatus(null)
    } catch (error) {
      setStatementStatus(error instanceof Error ? error.message : 'Statement import failed')
    } finally {
      setStatementImporting(false)
    }
  }

  const handlePdfImport = async () => {
    if (!selectedPdfFile) {
      setPdfStatus('Choose a PDF before analyzing.')
      return
    }

    setPdfImporting(true)
    setPdfStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedPdfFile)

      const response = await fetch('/api/connectors/ingest/pdf', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json().catch(() => ({})) as {
        error?: { message?: string } | string
        candidates?: Array<{
          raw_line: string
          balance: number
          program_id: string | null
          program_matched_name: string | null
          confidence: 'exact' | 'alias' | 'fuzzy' | null
        }>
      }
      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'PDF import failed')
      }

      const candidates = buildReviewCandidates('pdf', payload.candidates ?? [])
      setReviewCandidates(candidates)
      setReviewSource('pdf')
      setPdfStatus(`Review ${candidates.length} detected balance${candidates.length === 1 ? '' : 's'} before saving.`)
      setConfirmStatus(null)
      setSelectedPdfFile(null)
    } catch (error) {
      setPdfStatus(error instanceof Error ? error.message : 'PDF import failed')
    } finally {
      setPdfImporting(false)
    }
  }

  const updateReviewCandidate = (candidateId: string, updates: Partial<ImportReviewCandidate>) => {
    setReviewCandidates((prev) =>
      prev.map((candidate) => (candidate.id === candidateId ? { ...candidate, ...updates } : candidate)),
    )
  }

  const handleConfirmImport = async () => {
    const candidatesToSave = reviewCandidates
      .filter((candidate) => candidate.selected && candidate.program_id)
      .map((candidate) => ({
        program_id: candidate.program_id as string,
        balance: candidate.balance,
      }))

    if (candidatesToSave.length === 0) {
      setConfirmStatus('Select at least one matched balance before saving.')
      return
    }

    setConfirmSaving(true)
    setConfirmStatus(null)

    try {
      const response = await fetch('/api/connectors/ingest/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: candidatesToSave }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } | string; saved_count?: number }
      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Failed to save imported balances')
      }

      setConfirmStatus(
        `Saved ${payload.saved_count ?? candidatesToSave.length} balance${(payload.saved_count ?? candidatesToSave.length) === 1 ? '' : 's'} to your wallet.`,
      )
      setReviewCandidates([])
      setReviewSource(null)
      setStatementText('')
      await fetchAccounts()
    } catch (error) {
      setConfirmStatus(error instanceof Error ? error.message : 'Failed to save imported balances')
    } finally {
      setConfirmSaving(false)
    }
  }

  const renderCsvImportSection = () => (
    <div ref={csvImportSectionRef} className="mt-4 rounded-xl border border-pm-border bg-pm-surface-soft p-4" data-testid="csv-import-section">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <p className="pm-label">Import from CSV</p>
          <p className="mt-1 text-sm text-pm-ink-700">
            Upload a statement export or use one of the starter templates below. This is the recommended wallet-import path until direct provider onboarding is live.
          </p>
          <p className="mt-2 text-xs text-pm-ink-500">
            {selectedTemplate.instruction}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedTemplateKey}
            onChange={(event) => setSelectedTemplateKey(event.target.value as (typeof CSV_TEMPLATES)[number]['key'])}
            className="rounded-lg border border-pm-border bg-pm-surface px-3 py-2 text-sm text-pm-ink-900"
            data-testid="csv-template-select"
          >
            {CSV_TEMPLATES.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label}
              </option>
            ))}
          </select>
          <a
            href={buildCsvTemplateUrl(selectedTemplate.csv)}
            download={selectedTemplate.fileName}
            className="pm-button-secondary text-center text-xs px-4 py-2"
            data-testid="csv-template-download"
          >
            Download template
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-pm-border bg-pm-surface px-3 py-2 text-sm text-pm-ink-700"
          data-testid="csv-file-input"
        />
        <button
          type="button"
          onClick={handleCsvImport}
          disabled={csvImporting}
          className="pm-button whitespace-nowrap text-xs px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="csv-import-button"
        >
          {csvImporting ? 'Importing…' : 'Import CSV'}
        </button>
      </div>

      {selectedFile && (
        <p className="mt-2 text-xs text-pm-ink-500">
          Ready to import: <span className="font-medium text-pm-ink-700">{selectedFile.name}</span>
        </p>
      )}
      {csvStatus && (
        <p className="mt-2 text-xs text-pm-accent-strong" data-testid="csv-import-status">
          {csvStatus}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-pm-border bg-pm-surface p-4">
          <p className="pm-label">Paste statement text</p>
          <p className="mt-1 text-xs text-pm-ink-500">
            Copy the rewards summary from your bank portal or statement email and review the detected balances before saving.
          </p>
          <textarea
            value={statementText}
            onChange={(event) => setStatementText(event.target.value)}
            rows={6}
            className="mt-3 w-full rounded-lg border border-pm-border bg-pm-surface-soft px-3 py-2 text-sm text-pm-ink-900"
            placeholder="Paste rewards text here"
          />
          <button
            type="button"
            onClick={handleStatementImport}
            disabled={statementImporting}
            className="pm-button mt-3 text-xs px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {statementImporting ? 'Analyzing…' : 'Analyze text'}
          </button>
          {statementStatus && <p className="mt-2 text-xs text-pm-accent-strong">{statementStatus}</p>}
        </div>

        <div className="rounded-lg border border-pm-border bg-pm-surface p-4">
          <p className="pm-label">Analyze PDF statement</p>
          <p className="mt-1 text-xs text-pm-ink-500">
            Works best for text-searchable PDFs. Scanned image PDFs should use CSV or pasted text instead.
          </p>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setSelectedPdfFile(event.target.files?.[0] ?? null)}
            className="mt-3 block w-full rounded-lg border border-pm-border bg-pm-surface-soft px-3 py-2 text-sm text-pm-ink-700"
          />
          <button
            type="button"
            onClick={handlePdfImport}
            disabled={pdfImporting}
            className="pm-button mt-3 text-xs px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pdfImporting ? 'Analyzing…' : 'Analyze PDF'}
          </button>
          {pdfStatus && <p className="mt-2 text-xs text-pm-accent-strong">{pdfStatus}</p>}
        </div>
      </div>

      {reviewCandidates.length > 0 && (
        <div className="mt-6 rounded-lg border border-pm-border bg-pm-surface p-4" data-testid="import-review-section">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="pm-label">Review imported balances</p>
              <p className="mt-1 text-xs text-pm-ink-500">
                Confirm the detected rows before saving them to your wallet.
              </p>
            </div>
            <span className="rounded-full border border-pm-border bg-pm-surface-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-pm-ink-500">
              {reviewSource}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {reviewCandidates.map((candidate) => (
              <div key={candidate.id} className="rounded-lg border border-pm-border bg-pm-surface-soft p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={candidate.selected}
                    onChange={(event) => updateReviewCandidate(candidate.id, { selected: event.target.checked })}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-pm-ink-900">{candidate.label}</p>
                    <p className="mt-1 text-xs text-pm-ink-500">{candidate.balance.toLocaleString()} points</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                      <select
                        value={candidate.program_id ?? ''}
                        onChange={(event) =>
                          updateReviewCandidate(candidate.id, {
                            program_id: event.target.value || null,
                            selected: event.target.value.length > 0,
                          })
                        }
                        className="rounded-lg border border-pm-border bg-pm-surface px-3 py-2 text-sm text-pm-ink-900"
                      >
                        <option value="">Select program</option>
                        {importPrograms.map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.name}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-pm-ink-500">
                        {candidate.confidence ?? 'unmatched'}
                        {candidate.program_matched_name ? ` · ${candidate.program_matched_name}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={confirmSaving}
              className="pm-button text-xs px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirmSaving ? 'Saving…' : 'Save selected balances'}
            </button>
            <button
              type="button"
              onClick={() => {
                setReviewCandidates([])
                setReviewSource(null)
                setConfirmStatus(null)
              }}
              className="pm-button-secondary text-xs px-4 py-2"
            >
              Clear review
            </button>
          </div>

          {confirmStatus && <p className="mt-3 text-xs text-pm-accent-strong">{confirmStatus}</p>}
        </div>
      )}

      {confirmStatus && reviewCandidates.length === 0 && (
        <p className="mt-4 text-xs text-pm-accent-strong" data-testid="import-confirm-status">
          {confirmStatus}
        </p>
      )}
    </div>
  )

  const renderWalletReadiness = () => (
    <div className="mb-4 rounded-xl border border-pm-border bg-pm-surface-soft p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-pm-success-border bg-pm-success-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-pm-success">
          Live now
        </span>
        <span className="text-xs text-pm-ink-700">Manual balances, CSV import, statement parsing, and PDF review</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-pm-warning-border bg-pm-warning-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-pm-warning">
          Early access
        </span>
        <span className="text-xs text-pm-ink-700">Direct provider sync stays limited to existing linked accounts until onboarding opens.</span>
      </div>
    </div>
  )

  // Loading State
  if (viewState.type === 'loading') {
    return (
      <div className={`pm-card p-6 ${className}`} data-testid="connected-wallets-loading">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="pm-heading text-base">Wallet Sources</h2>
            <p className="text-xs text-pm-ink-500 mt-0.5">Manual balances, imports, and synced sources all land here.</p>
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-pm-accent border-t-transparent animate-spin" />
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-pm-surface-soft rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Error State
  if (viewState.type === 'error') {
    return (
      <div className={`pm-card p-6 ${className}`} data-testid="connected-wallets-error">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="pm-heading text-base">Wallet Sources</h2>
            <p className="text-xs text-pm-ink-500 mt-0.5">Manual balances, imports, and synced sources all land here.</p>
          </div>
        </div>
        {renderWalletReadiness()}
        <div className="text-center py-6">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-sm text-pm-danger mb-3">{viewState.message}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={fetchAccounts}
              className="pm-button text-xs px-4 py-2"
            >
              Retry
            </button>
            {onManualEntry && (
              <button
                onClick={onManualEntry}
                className="pm-button-secondary text-xs px-4 py-2"
              >
                Enter Balance Manually
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Empty State
  if (viewState.type === 'empty') {
    return (
      <div className={`pm-card p-6 ${className}`} data-testid="connected-wallets-empty">
        <div className="mb-4">
          <h2 className="pm-heading text-base">Wallet Sources</h2>
          <p className="text-xs text-pm-ink-500 mt-0.5">Manual balances, imports, and synced sources all land here.</p>
        </div>
        {renderWalletReadiness()}
        <div className="text-center py-6 border border-dashed border-pm-border rounded-xl">
          <div className="text-3xl mb-2">👛</div>
          <p className="text-sm text-pm-ink-700 mb-1">{isGuest ? 'Sign in to unlock saved wallet sources' : 'No wallet sources added yet'}</p>
          <p className="text-xs text-pm-ink-500 mb-4 max-w-sm mx-auto">
            {isGuest ? 'Guests can use manual balances right now. Sign in to save them, import files, and view synced sources when provider onboarding expands.' : 'Start with CSV import, statement text, or manual entry. Existing linked sources still sync here, but new provider onboarding is not exposed broadly yet.'}
          </p>
          <div className="flex gap-2 justify-center">
            {!isGuest && (
              <button
                onClick={handleConnect}
                className="pm-button text-xs px-4 py-2"
                data-testid="connect-wallet-btn"
              >
                Import Balances
              </button>
            )}
            {onManualEntry && (
              <button
                onClick={onManualEntry}
                className={`text-xs px-4 py-2 ${isGuest ? 'pm-button' : 'pm-button-secondary'}`}
                data-testid="manual-entry-btn"
              >
                Enter Balance Manually
              </button>
            )}
          </div>
        </div>
        {!isGuest && renderCsvImportSection()}
      </div>
    )
  }

  // Connected State
  const { accounts, balances } = viewState
      return (
    <div className={`pm-card p-6 ${className}`} data-testid="connected-wallets-connected">
        <div className="flex items-center justify-between mb-4">
          <div>
          <h2 className="pm-heading text-base">Wallet Sources</h2>
          <p className="text-xs text-pm-ink-500 mt-0.5">Manual balances, imports, and synced sources all land here. Existing linked accounts can sync here; new provider onboarding is not yet exposed broadly.</p>
          </div>
        <div className="flex gap-2">
          {onManualEntry && (
            <button
              onClick={onManualEntry}
              className="pm-button-secondary text-xs px-3 py-1.5"
              data-testid="manual-entry-btn"
            >
              Manual Entry
            </button>
          )}
          <button
            onClick={handleConnect}
            className="pm-button text-xs px-3 py-1.5"
            data-testid="connect-wallet-btn"
          >
            Import Balances
          </button>
        </div>
      </div>
      {renderWalletReadiness()}

      <div className="space-y-3">
        {accounts.map(account => {
          const balanceInfo = balances[account.id]
          return (
          <div
            key={account.id}
            className="flex items-center justify-between p-3 bg-pm-surface-soft rounded-lg border border-pm-border"
            data-testid={`wallet-item-${account.id}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl flex-shrink-0">{PROVIDER_ICONS[account.provider]}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-pm-ink-900 truncate">
                    {account.display_name || PROVIDER_DISPLAY_NAMES[account.provider]}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getStatusBadgeClass(account.status)}`}
                  >
                    {account.status}
                  </span>
                  {balanceInfo && (
                    <>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getSourceBadgeClass(balanceInfo.source)}`}
                        title="Data source"
                      >
                        {balanceInfo.source === 'connector' ? '🔗 Auto' : '✏️ Manual'}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getConfidenceBadgeClass(balanceInfo.confidence)}`}
                        title="Data freshness confidence"
                      >
                        {balanceInfo.confidence === 'high' ? '● Fresh' : balanceInfo.confidence === 'medium' ? '◐ Stale' : '○ Old'}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-pm-ink-500 mt-1">
                  {balanceInfo && (
                    <span className="font-medium text-pm-accent">
                      {balanceInfo.balance.toLocaleString()} pts
                    </span>
                  )}
                  <span>•</span>
                  <span className={getSyncStatusBadgeClass(account.sync_status)}>
                    {account.sync_status === 'syncing' ? '⟳ Syncing...' : `Synced ${formatLastSynced(account.last_synced_at)}`}
                  </span>
                  {account.last_error && account.sync_status === 'error' && (
                    <span className="text-pm-danger truncate max-w-[200px]" title={account.last_error}>
                      • {account.last_error}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {/* Sync button - disabled if not active or already syncing */}
              <button
                onClick={() => handleSync(account.id)}
                disabled={actionLoading[account.id] || account.status !== 'active' || account.sync_status === 'syncing'}
                className="p-2 rounded-lg text-pm-ink-500 hover:text-pm-accent hover:bg-pm-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Sync now"
                data-testid={`sync-btn-${account.id}`}
              >
                {actionLoading[account.id] && !showDeleteConfirm ? (
                  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>

              {/* Disconnect button */}
              {account.status === 'active' && (
                <button
                  onClick={() => handleDisconnect(account.id)}
                  disabled={actionLoading[account.id]}
                  className="p-2 rounded-lg text-pm-ink-500 hover:text-pm-warning hover:bg-pm-warning-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Disconnect"
                  data-testid={`disconnect-btn-${account.id}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>
              )}

              {/* Delete button */}
              {showDeleteConfirm === account.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(account.id)}
                    disabled={actionLoading[account.id]}
                    className="p-1.5 rounded-lg text-xs bg-pm-danger text-white hover:bg-pm-danger/90 disabled:opacity-50"
                    data-testid={`confirm-delete-btn-${account.id}`}
                  >
                    {actionLoading[account.id] ? '...' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="p-1.5 rounded-lg text-xs bg-pm-surface text-pm-ink-500 hover:bg-pm-surface-soft"
                    data-testid={`cancel-delete-btn-${account.id}`}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(account.id)}
                  className="p-2 rounded-lg text-pm-ink-500 hover:text-pm-danger hover:bg-pm-danger-soft transition-colors"
                  title="Delete permanently"
                  data-testid={`delete-btn-${account.id}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          )
        })}
      </div>
      {renderCsvImportSection()}
    </div>
  )
}
