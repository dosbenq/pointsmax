/**
 * Sanitizes JSON-LD content to prevent XSS attacks via dangerouslySetInnerHTML.
 * Removes dangerous HTML tags and ensures the output is safe JSON.
 */

const DANGEROUS_PATTERN = /<\/script|\bjavascript:|on\w+\s*=/gi

export function sanitizeJsonLd(obj: unknown): string {
  const json = JSON.stringify(obj)
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
