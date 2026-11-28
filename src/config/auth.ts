// Where sign-in lives publicly. Kept in src/config with the other URLs.

function toOrigin(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const value = raw.trim()
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).origin
  } catch {
    return null
  }
}

/**
 * The public origin Google redirects back to. It must match the redirect URI
 * registered on the Google OAuth client exactly, so production uses the
 * project's production domain rather than the per-deployment URL.
 */
export function getAuthBaseUrl(): string {
  return (
    toOrigin(process.env.BETTER_AUTH_URL) ||
    toOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    (process.env.VERCEL_ENV === 'production' ? toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) : null) ||
    toOrigin(process.env.VERCEL_URL) ||
    `http://localhost:${process.env.PORT ?? 3000}`
  )
}

/** Google's OAuth token endpoint (used by the setup self-check to validate the client secret). */
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
