/**
 * Which optional integrations are configured (reported by /api/health).
 * Database and sign-in settings are checked by src/lib/setup-readiness.ts.
 */

/**
 * Check if a specific feature is configured
 */
export function isFeatureEnabled(feature: 'stripe' | 'resend' | 'sentry' | 'seats_aero' | 'gemini'): boolean {
  switch (feature) {
    case 'stripe':
      return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET
    case 'resend':
      return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL
    case 'sentry':
      return !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN
    case 'seats_aero':
      return !!process.env.SEATS_AERO_API_KEY
    case 'gemini':
      return !!process.env.GEMINI_API_KEY
    default:
      return false
  }
}

/**
 * Get feature configuration status for health checks
 */
export function getFeatureStatus(): Record<string, boolean> {
  return {
    stripe: isFeatureEnabled('stripe'),
    resend: isFeatureEnabled('resend'),
    sentry: isFeatureEnabled('sentry'),
    seats_aero: isFeatureEnabled('seats_aero'),
    gemini: isFeatureEnabled('gemini'),
    rate_limiting_distributed: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
  }
}
