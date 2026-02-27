import { trackEvent } from '@/lib/analytics'
import type { CalculatorActionStripContext, CalculatorActionStripEvent } from '../domain/action-strip'

export function trackCalculatorActionStrip(
  event: CalculatorActionStripEvent,
  context: CalculatorActionStripContext,
): void {
  trackEvent(event, { region: context.region })
}
