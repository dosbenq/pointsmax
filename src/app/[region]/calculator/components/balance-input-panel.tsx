// ============================================================
// BalanceInputPanel — Sprint 18
// Extracted from 2033-line calculator
// Handles balance row inputs with program selector
// ============================================================

'use client'

import type { Program, BalanceRow } from '../hooks/use-calculator-state'

interface BalanceInputPanelProps {
  programs: Program[]
  programsLoading: boolean
  rows: BalanceRow[]
  totalTrackedPoints: number
  saveToast: boolean
  calcError: string | null
  byType: (type: string) => Program[]
  onAddRow: () => void
  onRemoveRow: (id: string) => void
  onUpdateRow: (id: string, field: 'program_id' | 'amount', value: string) => void
}

export function BalanceInputPanel({
  programs,
  programsLoading,
  rows,
  totalTrackedPoints,
  saveToast,
  calcError,
  byType,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}: BalanceInputPanelProps) {
  return (
    <div className="pm-card-soft overflow-hidden">
      <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-pm-border flex items-center justify-between gap-3">
        <div>
          <h2 className="pm-heading text-lg">1. Your Points Balances</h2>
          <p className="pm-subtle text-xs mt-0.5">Add one or many programs. We normalize and rank options for you.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {saveToast && (
            <span className="pm-pill text-pm-success border-pm-success/30 bg-pm-success/10">
              ✓ Balances saved
            </span>
          )}
          <span className="pm-pill">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-3">
        {programsLoading && (
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="w-3 h-3 rounded-full flex-shrink-0 bg-pm-accent/20 animate-pulse" />
            <div className="pm-input flex-1 bg-pm-surface-soft text-pm-ink-500 cursor-not-allowed">
              Loading programs…
            </div>
            <div className="pm-input w-28 sm:w-36 bg-pm-surface-soft" />
          </div>
        )}
        {!programsLoading && rows.map((row) => {
          const selected = programs.find((p) => p.id === row.program_id)
          return (
            <div key={row.id} className="flex items-center gap-2.5 sm:gap-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-white"
                style={{ backgroundColor: selected?.color_hex ?? '#c7d9ce' }}
              />
              <select
                value={row.program_id}
                onChange={(e) => onUpdateRow(row.id, 'program_id', e.target.value)}
                className="pm-input flex-1"
                disabled={programsLoading}
              >
                <option value="">Select a program…</option>
                <optgroup label="Transferable Points">
                  {byType('transferable_points').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
                <optgroup label="Airline Miles">
                  {byType('airline_miles').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
                <optgroup label="Hotel Points">
                  {byType('hotel_points').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              </select>
              <input
                type="text"
                inputMode="numeric"
                placeholder="80,000"
                value={row.amount}
                onChange={(e) => onUpdateRow(row.id, 'amount', e.target.value)}
                className="pm-input w-28 sm:w-36 text-right"
              />
              {rows.length > 1 && (
                <button
                  onClick={() => onRemoveRow(row.id)}
                  className="w-8 h-8 rounded-lg text-pm-ink-500 hover:text-pm-danger hover:bg-red-50 transition-colors text-lg leading-none flex-shrink-0"
                  aria-label="Remove program"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {calcError && (
        <div className="mx-5 sm:mx-6 mb-4 text-sm text-pm-danger bg-red-50 rounded-xl px-4 py-2 border border-pm-danger/20">
          {calcError}
        </div>
      )}

      <div className="px-5 sm:px-6 py-4 bg-pm-surface-soft border-t border-pm-border flex items-center justify-between gap-3">
        <button onClick={onAddRow} className="pm-button-secondary px-4 py-2 text-sm">
          + Add program
        </button>
        <span className="text-xs text-pm-ink-500">
          {totalTrackedPoints.toLocaleString()} total tracked points
        </span>
      </div>
    </div>
  )
}
