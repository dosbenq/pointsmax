/**
 * Environment Variable Validation
 * Catches configuration issues at startup, not runtime
 */

import { logError, logInfo } from './logger'

export type EnvVarType = 'string' | 'url' | 'number' | 'boolean' | 'enum' | 'email'

interface EnvVarConfig {
  name: string
  type: EnvVarType
  required: boolean
  default?: string
  options?: string[]  // For enum type
  validate?: (value: string) => boolean | string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  values: Record<string, string | number | boolean>
}

// Required environment variables for production
const REQUIRED_ENV_VARS: EnvVarConfig[] = [
  // Supabase (Critical)
  { name: 'NEXT_PUBLIC_SUPABASE_URL', type: 'url', required: true },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', type: 'string', required: true },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', type: 'string', required: process.env.NODE_ENV === 'production' },

  // App Configuration
  { name: 'NEXT_PUBLIC_APP_URL', type: 'url', required: true },

  // AI Services (Optional but recommended)
  { name: 'GEMINI_API_KEY', type: 'string', required: false },

  // External APIs (Optional)
  { name: 'SEATS_AERO_API_KEY', type: 'string', required: false },

  // Rate Limiting (Optional - falls back to in-memory)
  { name: 'UPSTASH_REDIS_REST_URL', type: 'url', required: false },
  { name: 'UPSTASH_REDIS_REST_TOKEN', type: 'string', required: false },

  // Monitoring (Optional but recommended for production)
  { name: 'SENTRY_DSN', type: 'url', required: false },
  { name: 'NEXT_PUBLIC_SENTRY_DSN', type: 'url', required: false },

  // Payments (Optional)
  { name: 'STRIPE_SECRET_KEY', type: 'string', required: false, validate: (v) => v.startsWith('sk_') || 'Must start with sk_' },
  { name: 'STRIPE_WEBHOOK_SECRET', type: 'string', required: false, validate: (v) => v.startsWith('whsec_') || 'Must start with whsec_' },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', type: 'string', required: false, validate: (v) => v.startsWith('pk_') || 'Must start with pk_' },

  // Email (Optional)
  { name: 'RESEND_API_KEY', type: 'string', required: false, validate: (v) => v.startsWith('re_') || 'Must start with re_' },
  { name: 'RESEND_FROM_EMAIL', type: 'email', required: false },

  // Workflows (Optional)
  { name: 'INNGEST_EVENT_KEY', type: 'string', required: false },
  { name: 'INNGEST_SIGNING_KEY', type: 'string', required: false },

  // Admin (Optional)
  { name: 'ADMIN_API_KEY', type: 'string', required: false, validate: (v) => v.length >= 32 || 'Must be at least 32 characters' },

  // Security (Optional)
  { name: 'CORS_ALLOWED_ORIGINS', type: 'url', required: false },
]

function validateValue(value: string, config: EnvVarConfig): string | null {
  // Check type
  switch (config.type) {
    case 'url': {
      try {
        new URL(value)
      } catch {
        return `Must be a valid URL`
      }
      break
    }
    case 'number': {
      if (isNaN(Number(value))) {
        return `Must be a number`
      }
      break
    }
    case 'boolean': {
      if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
        return `Must be true/false`
      }
      break
    }
    case 'enum': {
      if (config.options && !config.options.includes(value)) {
        return `Must be one of: ${config.options.join(', ')}`
      }
      break
    }
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return `Must be a valid email address`
      }
      break
    }
  }

  // Run custom validation
  if (config.validate) {
    const result = config.validate(value)
    if (typeof result === 'string') {
      return result
    }
    if (!result) {
      return `Failed custom validation`
    }
  }

  return null
}

export function validateEnv(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const values: Record<string, string | number | boolean> = {}

  for (const config of REQUIRED_ENV_VARS) {
    const rawValue = process.env[config.name]

    // Handle missing values
    if (!rawValue) {
      if (config.required) {
        errors.push(`Missing required environment variable: ${config.name}`)
      } else if (config.default) {
        warnings.push(`Using default value for ${config.name}`)
        values[config.name] = config.default
      }
      continue
    }

    // Validate the value
    const error = validateValue(rawValue, config)
    if (error) {
      errors.push(`Invalid ${config.name}: ${error}`)
      continue
    }

    // Convert and store
    switch (config.type) {
      case 'number':
        values[config.name] = Number(rawValue)
        break
      case 'boolean':
        values[config.name] = ['true', '1'].includes(rawValue.toLowerCase())
        break
      default:
        values[config.name] = rawValue
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    values,
  }
}

/**
 * Assert environment is valid - throws if not
 * Call this at application startup
 */
export function assertValidEnv(): void {
  const result = validateEnv()

  // Log warnings
  for (const warning of result.warnings) {
    logInfo('env_validation_warning', { warning })
  }

  // Log and throw errors
  if (!result.valid) {
    for (const error of result.errors) {
      logError('env_validation_error', { error })
    }

    throw new Error(
      `Environment validation failed:\n${result.errors.join('\n')}`
    )
  }

  logInfo('env_validation_success', {
    configuredVars: Object.keys(result.values).length,
  })
}

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
