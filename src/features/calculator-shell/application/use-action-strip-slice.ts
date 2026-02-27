// ============================================================
// useActionStripSlice — G1-T2 Refactor
// Encapsulates action strip flow state and handlers
// Maintains callback and tracking parity with legacy flow
// ============================================================

'use client'

import { useMemo } from 'react'
import type { CalculatorActionStripCallbacks, CalculatorActionStripContext } from '../domain/action-strip'
import { createActionStripHandlers, type ActionStripTracker } from './create-action-strip-handlers'
import { trackCalculatorActionStrip } from '../infrastructure/action-strip-analytics'

export interface ActionStripSliceState {
  visible: boolean
  shareBusy: boolean
  context: CalculatorActionStripContext
}

export interface ActionStripSliceActions {
  onBook: () => void
  onShare: () => void
  onAlert: () => void
}

export interface ActionStripSlice {
  state: ActionStripSliceState
  actions: ActionStripSliceActions
}

export interface UseActionStripSliceOptions {
  visible: boolean
  region: string
  shareBusy?: boolean
  onBook: () => void
  onShare: () => void
  onAlert: () => void
  tracker?: ActionStripTracker
}

/**
 * useActionStripSlice — Feature slice hook for calculator action strip
 * 
 * Encapsulates the flow state and handler wiring for the action strip
 * component. Maintains tracking parity and callback behavior from
 * legacy calculator implementation.
 * 
 * @example
 * ```tsx
 * const { state, actions } = useActionStripSlice({
 *   visible: Boolean(result),
 *   region,
 *   shareBusy,
 *   onBook: () => switchPanel('awards', 'action_strip'),
 *   onShare: shareTripSnapshot,
 *   onAlert: () => alertRef.current?.scrollIntoView({ behavior: 'smooth' }),
 * })
 * 
 * return (
 *   <CalculatorActionStrip
 *     visible={state.visible}
 *     region={state.context.region}
 *     shareBusy={state.shareBusy}
 *     onBook={actions.onBook}
 *     onShare={actions.onShare}
 *     onAlert={actions.onAlert}
 *   />
 * )
 * ```
 */
export function useActionStripSlice(options: UseActionStripSliceOptions): ActionStripSlice {
  const {
    visible,
    region,
    shareBusy = false,
    onBook,
    onShare,
    onAlert,
    tracker = trackCalculatorActionStrip,
  } = options

  const context: CalculatorActionStripContext = useMemo(
    () => ({ region }),
    [region]
  )

  const callbacks: CalculatorActionStripCallbacks = useMemo(
    () => ({ onBook, onShare, onAlert }),
    [onBook, onShare, onAlert]
  )

  const handlers = useMemo(
    () => createActionStripHandlers(callbacks, context, tracker),
    [callbacks, context, tracker]
  )

  // Memoize actions to prevent unnecessary re-renders
  const actions: ActionStripSliceActions = useMemo(
    () => ({
      onBook: handlers.onBook,
      onShare: handlers.onShare,
      onAlert: handlers.onAlert,
    }),
    [handlers]
  )

  const state: ActionStripSliceState = useMemo(
    () => ({
      visible,
      shareBusy,
      context,
    }),
    [visible, shareBusy, context]
  )

  return useMemo(
    () => ({ state, actions }),
    [state, actions]
  )
}

/**
 * createActionStripSlice — Factory for imperative slice creation
 * 
 * Used for non-React contexts (tests, server-side, stories)
 * where hook usage is not available.
 */
export function createActionStripSlice(
  options: Omit<UseActionStripSliceOptions, 'tracker'> & { tracker?: ActionStripTracker }
): ActionStripSlice {
  const { visible, region, shareBusy = false, onBook, onShare, onAlert, tracker = trackCalculatorActionStrip } = options

  const context: CalculatorActionStripContext = { region }
  const callbacks: CalculatorActionStripCallbacks = { onBook, onShare, onAlert }
  const handlers = createActionStripHandlers(callbacks, context, tracker)

  return {
    state: {
      visible,
      shareBusy,
      context,
    },
    actions: {
      onBook: handlers.onBook,
      onShare: handlers.onShare,
      onAlert: handlers.onAlert,
    },
  }
}
