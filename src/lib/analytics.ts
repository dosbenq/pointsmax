type EventPayload = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(event: string, payload: EventPayload = {}) {
  if (typeof window === 'undefined') return

  const data = {
    event,
    ts: Date.now(),
    ...payload,
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(data)
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', event, payload)
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[analytics]', data)
  }
}
