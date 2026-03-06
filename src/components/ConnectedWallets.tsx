'use client'

import { useState, useEffect, useCallback } from 'react'
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
}

export function ConnectedWallets({ onManualEntry, className = '' }: ConnectedWalletsProps) {
  const [viewState, setViewState] = useState<ViewState>({ type: 'loading' })
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

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

  const handleConnect = () => {
    if (onManualEntry) {
      onManualEntry()
      return
    }

    setViewState({
      type: 'error',
      message: 'Balance entry is unavailable right now. Please reload and try again.',
    })
  }

  // Loading State
  if (viewState.type === 'loading') {
    return (
      <div className={`pm-card p-6 ${className}`} data-testid="connected-wallets-loading">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="pm-heading text-base">Wallet Sources</h2>
            <p className="text-xs text-pm-ink-500 mt-0.5">Manage imported and synced balance sources.</p>
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
            <p className="text-xs text-pm-ink-500 mt-0.5">Manage imported and synced balance sources.</p>
          </div>
        </div>
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
          <p className="text-xs text-pm-ink-500 mt-0.5">Manage imported and synced balance sources.</p>
        </div>
        <div className="text-center py-6 border border-dashed border-pm-border rounded-xl">
          <div className="text-3xl mb-2">👛</div>
          <p className="text-sm text-pm-ink-700 mb-1">No balance sources added yet</p>
          <p className="text-xs text-pm-ink-500 mb-4 max-w-sm mx-auto">
            Import balances from CSV or enter them manually. Live account linking is still in beta.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleConnect}
              className="pm-button text-xs px-4 py-2"
              data-testid="connect-wallet-btn"
            >
              Add Balances
            </button>
            {onManualEntry && (
              <button
                onClick={onManualEntry}
                className="pm-button-secondary text-xs px-4 py-2"
                data-testid="manual-entry-btn"
              >
                Enter Balance Manually
              </button>
            )}
          </div>
        </div>
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
          <p className="text-xs text-pm-ink-500 mt-0.5">Manage imported and synced balance sources.</p>
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
            Add Balances
          </button>
        </div>
      </div>

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
    </div>
  )
}
