/**
 * Origins the browser may call from PointsMax pages (CSP connect-src), besides
 * the site itself: Stripe checkout, Sentry error reports and PostHog analytics.
 */
export const CSP_CONNECT_ORIGINS = [
  'https://api.stripe.com',
  'https://*.sentry.io',
  'https://us.i.posthog.com',
  'https://*.posthog.com',
] as const
