const REQUIRED_SERVER_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const OPTIONAL_SERVER_ENV = [
  'ADMIN_EMAIL',
  'ADMIN_ALLOWED_EMAILS',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_MODEL_CANDIDATES',
  'SEATS_AERO_API_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CRON_SECRET',
  'ALERTS_TOKEN_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'CORS_ALLOWED_ORIGINS',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
  'HEALTHCHECK_SECRET',
  'DEFAULT_CPP_CENTS',
  'DEFAULT_CPP_TRANSFERABLE_POINTS',
  'DEFAULT_CPP_AIRLINE_MILES',
  'DEFAULT_CPP_HOTEL_POINTS',
  'DEFAULT_CPP_CASHBACK',
  'NEXT_PUBLIC_ADMIN_EMAIL',
  'NEXT_PUBLIC_ADMIN_ALLOWED_EMAILS',
] as const

export function getMissingServerEnv(): string[] {
  return REQUIRED_SERVER_ENV.filter((key) => {
    const value = process.env[key]
    return !value || !value.trim()
  })
}

export function getEnvSummary() {
  const requiredPresent = REQUIRED_SERVER_ENV.filter((key) => !!process.env[key]?.trim())
  const requiredMissing = REQUIRED_SERVER_ENV.filter((key) => !process.env[key]?.trim())
  const optionalPresent = OPTIONAL_SERVER_ENV.filter((key) => !!process.env[key]?.trim())
  const optionalMissing = OPTIONAL_SERVER_ENV.filter((key) => !process.env[key]?.trim())

  return {
    requiredPresent,
    requiredMissing,
    optionalPresent,
    optionalMissing,
  }
}

export function assertServerEnv(): void {
  const missing = getMissingServerEnv()
  if (missing.length === 0) return
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
}

export function shouldAssertServerEnvAtStartup(): boolean {
  if (process.env.NODE_ENV !== 'production') return false

  // Skip build-time assertion so Next/Vercel can collect static page config.
  return process.env.NEXT_PHASE !== 'phase-production-build'
}
