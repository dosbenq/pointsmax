export type CalculatorActionStripEvent =
  | 'calculator_cta_book_clicked'
  | 'calculator_cta_share_clicked'
  | 'calculator_cta_alert_clicked'

export interface CalculatorActionStripContext {
  region: string
}

export interface CalculatorActionStripCallbacks {
  onBook: () => void
  onShare: () => void
  onAlert: () => void
}
