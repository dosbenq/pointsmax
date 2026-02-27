import type { CalculatorActionStripCallbacks, CalculatorActionStripContext, CalculatorActionStripEvent } from '../domain/action-strip'

export type ActionStripTracker = (
  event: CalculatorActionStripEvent,
  context: CalculatorActionStripContext,
) => void

export function createActionStripHandlers(
  callbacks: CalculatorActionStripCallbacks,
  context: CalculatorActionStripContext,
  tracker: ActionStripTracker,
) {
  return {
    onBook: () => {
      tracker('calculator_cta_book_clicked', context)
      callbacks.onBook()
    },
    onShare: () => {
      tracker('calculator_cta_share_clicked', context)
      callbacks.onShare()
    },
    onAlert: () => {
      tracker('calculator_cta_alert_clicked', context)
      callbacks.onAlert()
    },
  }
}
