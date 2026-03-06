'use client'

import React from 'react'
import type { CalculatorActionStripCallbacks } from '../domain/action-strip'
import { createActionStripHandlers } from '../application/create-action-strip-handlers'
import { trackCalculatorActionStrip } from '../infrastructure/action-strip-analytics'

export interface CalculatorActionStripProps extends CalculatorActionStripCallbacks {
  visible: boolean
  shareBusy?: boolean
  region: string
}

export function CalculatorActionStrip({
  visible,
  onBook,
  onShare,
  onAlert,
  shareBusy,
  region,
}: CalculatorActionStripProps) {
  if (!visible) return null

  const handlers = createActionStripHandlers(
    { onBook, onShare, onAlert },
    { region },
    trackCalculatorActionStrip,
  )

  return (
    <div className="pm-card bg-pm-surface-soft p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-pm-accent-border">
      <div>
        <h3 className="pm-heading text-lg font-bold text-pm-ink-900">Next Steps</h3>
        <p className="pm-subtle text-sm">Convert these points into your next trip.</p>
      </div>
      <div className="flex flex-wrap gap-3 w-full sm:w-auto">
        <button
          onClick={handlers.onBook}
          className="pm-button flex-1 sm:flex-initial px-6 py-2.5 text-sm font-bold bg-pm-accent hover:bg-pm-accent-strong text-pm-bg rounded-xl shadow-sm transition-all"
        >
          Book Flight
        </button>
        <button
          onClick={handlers.onShare}
          disabled={shareBusy}
          className="pm-button-secondary flex-1 sm:flex-initial px-6 py-2.5 text-sm font-bold border-pm-accent text-pm-accent hover:bg-pm-accent-soft rounded-xl transition-all"
        >
          {shareBusy ? 'Sharing...' : 'Share Plan'}
        </button>
        <button
          onClick={handlers.onAlert}
          className="pm-button-secondary flex-1 sm:flex-initial px-6 py-2.5 text-sm font-bold text-pm-ink-700 hover:bg-pm-surface rounded-xl transition-all"
        >
          Alert Me
        </button>
      </div>
    </div>
  )
}
