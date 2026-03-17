export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return

  const Sentry = await import('@sentry/nextjs')

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    enabled: true,
  })
}

export { captureRequestError as onRequestError } from '@sentry/nextjs'
