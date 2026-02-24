let cachedStoreUrl: string | null | undefined

type SentryParts = {
  host: string
  projectId: string
  publicKey: string
}

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

function getStoreUrl(): string | null {
  if (cachedStoreUrl !== undefined) return cachedStoreUrl
  const raw = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!raw) {
    cachedStoreUrl = null
    return cachedStoreUrl
  }
  const parsed = parseSentryDsn(raw)
  if (!parsed) {
    cachedStoreUrl = null
    return cachedStoreUrl
  }
  cachedStoreUrl = `${parsed.host}/api/${parsed.projectId}/store/?sentry_key=${encodeURIComponent(parsed.publicKey)}&sentry_version=7`
  return cachedStoreUrl
}

export function reportClientErrorToMonitoring(message: string, data?: Record<string, unknown>) {
  const storeUrl = getStoreUrl()
  if (!storeUrl) return

  const payload = {
    level: 'error',
    logger: 'pointsmax-client',
    platform: 'javascript',
    timestamp: Math.floor(Date.now() / 1000),
    message,
    extra: data ?? {},
    request: {
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    },
  }

  void fetch(storeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Never throw from client reporting.
  })
}
