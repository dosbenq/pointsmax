type EventProps = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    __pmPosthogDistinctId?: string
  }
}

function getPosthogConfig() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'
  if (!key) return null
  return { key, host: host.replace(/\/+$/, '') }
}

function ensureDistinctId(): string {
  if (typeof window === 'undefined') return 'server'
  if (window.__pmPosthogDistinctId) return window.__pmPosthogDistinctId
  const existing = window.localStorage.getItem('pm_posthog_distinct_id')
  if (existing) {
    window.__pmPosthogDistinctId = existing
    return existing
  }
  const generated = crypto.randomUUID()
  window.localStorage.setItem('pm_posthog_distinct_id', generated)
  window.__pmPosthogDistinctId = generated
  return generated
}

export function initPosthogClient() {
  if (typeof window === 'undefined') return
  ensureDistinctId()
}

export function capturePosthogEvent(event: string, properties: EventProps = {}) {
  if (typeof window === 'undefined') return
  const cfg = getPosthogConfig()
  if (!cfg) return

  const payload = {
    api_key: cfg.key,
    event,
    distinct_id: ensureDistinctId(),
    properties: {
      ...properties,
      $current_url: window.location.href,
      $pathname: window.location.pathname,
      $host: window.location.host,
    },
    timestamp: new Date().toISOString(),
  }

  void fetch(`${cfg.host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // analytics should never break UX
  })
}
