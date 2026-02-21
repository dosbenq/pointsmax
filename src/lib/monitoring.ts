import crypto from 'crypto'

type SentryParts = {
  host: string
  projectId: string
  publicKey: string
}

let cachedParts: SentryParts | null | undefined

function parseSentryDsn(rawDsn: string): SentryParts | null {
  try {
    const dsn = new URL(rawDsn)
    const publicKey = dsn.username
    const projectId = dsn.pathname.replace(/^\//, '')
    if (!publicKey || !projectId) return null
    return {
      host: `${dsn.protocol}//${dsn.host}`,
      projectId,
      publicKey,
    }
  } catch {
    return null
  }
}

function getSentryParts(): SentryParts | null {
  if (cachedParts !== undefined) return cachedParts
  const dsn = process.env.SENTRY_DSN?.trim()
  cachedParts = dsn ? parseSentryDsn(dsn) : null
  return cachedParts
}

export function reportErrorToMonitoring(event: string, data?: Record<string, unknown>): void {
  const sentry = getSentryParts()
  if (!sentry) return

  const eventId = crypto.randomUUID().replace(/-/g, '')
  const storeUrl = `${sentry.host}/api/${sentry.projectId}/store/?sentry_key=${encodeURIComponent(sentry.publicKey)}&sentry_version=7`
  const timestamp = Math.floor(Date.now() / 1000)

  const payload = {
    event_id: eventId,
    level: 'error',
    logger: 'pointsmax',
    platform: 'node',
    timestamp,
    message: event,
    extra: data ?? {},
  }

  void fetch(storeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  }).catch(() => {
    // swallow: observability should never break request handling
  })
}
