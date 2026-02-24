'use client'

import { useEffect } from 'react'
import { reportClientErrorToMonitoring } from '@/lib/monitoring-client'

export default function MonitoringBoot() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientErrorToMonitoring(event.message || 'window.error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === 'string'
            ? event.reason
            : 'Unhandled rejection'
      reportClientErrorToMonitoring(reason)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
