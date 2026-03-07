function toSafeOrigin(raw?: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

function getDevFallbackOrigin(): string {
  return process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3000'
}

export function getConfiguredAppOrigin(): string {
  return (
    toSafeOrigin(process.env.NEXT_PUBLIC_APP_URL?.trim()) ||
    toSafeOrigin(
      process.env.VERCEL_URL?.trim()
        ? `https://${process.env.VERCEL_URL.trim()}`
        : null,
    ) ||
    getDevFallbackOrigin()
  )
}

export function getSafeAppOrigin(requestOrigin?: string | null): string {
  return (
    toSafeOrigin(process.env.NEXT_PUBLIC_APP_URL?.trim()) ||
    toSafeOrigin(requestOrigin?.trim()) ||
    toSafeOrigin(
      process.env.VERCEL_URL?.trim()
        ? `https://${process.env.VERCEL_URL.trim()}`
        : null,
    ) ||
    getDevFallbackOrigin()
  )
}
