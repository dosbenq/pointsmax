import * as Sentry from '@sentry/nextjs'

/**
 * Report errors to monitoring (Sentry).
 * Uses the official @sentry/nextjs SDK instead of custom HTTP implementation.
 */
export function reportErrorToMonitoring(
  error: Error | string,
  context?: Record<string, unknown>
) {
  try {
    if (typeof error === 'string') {
      Sentry.captureMessage(error, { extra: context })
    } else {
      Sentry.captureException(error, { extra: context })
    }
  } catch {
    // Don't let monitoring failures crash the app
    console.error('[monitoring] Failed to report error:', error)
  }
}
