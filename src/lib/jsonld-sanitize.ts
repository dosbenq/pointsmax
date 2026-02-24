/**
 * Sanitizes JSON-LD content to prevent XSS attacks via dangerouslySetInnerHTML.
 * Removes dangerous HTML tags and ensures the output is safe JSON.
 */

const DANGEROUS_PATTERN = /<\/script|\bjavascript:|on\w+\s*=/gi

function stripUnsafeKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsafeKeys)
  }

  if (value && typeof value === 'object') {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/^on/i.test(key))
      .map(([key, nested]) => [key, stripUnsafeKeys(nested)] as const)
    return Object.fromEntries(sanitizedEntries)
  }

  return value
}

export function sanitizeJsonLd(obj: unknown): string {
  const safeObj = stripUnsafeKeys(obj)
  const json = JSON.stringify(safeObj)
  // Escape closing script tags and other dangerous patterns
  const sanitized = json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(DANGEROUS_PATTERN, '')
  return sanitized
}

/**
 * Creates a safe JSON-LD script props object for dangerouslySetInnerHTML.
 * Usage: <script type="application/ld+json" dangerouslySetInnerHTML={createSafeJsonLdScript(jsonLd)} />
 */
export function createSafeJsonLdScript(obj: unknown): { __html: string } {
  return { __html: sanitizeJsonLd(obj) }
}
