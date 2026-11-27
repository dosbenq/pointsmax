import * as Sentry from '@sentry/nextjs'
import { initPosthogClient } from '@/lib/posthog'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

// Product analytics: pageviews and events (no-op until a PostHog key is configured).
initPosthogClient()
