import * as Sentry from '@sentry/nextjs'

export function reportClientErrorToMonitoring(
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
    console.error('[monitoring-client] Failed to report error:', error)
  }
}
