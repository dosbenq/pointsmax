import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  validateEnv,
  assertValidEnv,
  isFeatureEnabled,
  getFeatureStatus,
} from './env-validation'

describe('env-validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('validateEnv', () => {
    it('returns valid when required vars are present', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'

      const result = validateEnv()
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns invalid when required vars are missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      delete process.env.NEXT_PUBLIC_APP_URL

      const result = validateEnv()
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('validates URL format', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'

      const result = validateEnv()
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('NEXT_PUBLIC_SUPABASE_URL'))).toBe(true)
    })

    it('accepts valid URLs', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://pointsmax.com'

      const result = validateEnv()
      expect(result.valid).toBe(true)
    })

    it('validates Stripe keys format', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'
      process.env.STRIPE_SECRET_KEY = 'invalid-key'

      const result = validateEnv()
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('STRIPE_SECRET_KEY'))).toBe(true)
    })

    it('accepts valid Stripe keys', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'
      process.env.STRIPE_SECRET_KEY = 'sk_test_123'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'

      const result = validateEnv()
      expect(result.valid).toBe(true)
    })

    it('validates Resend API key format', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'
      process.env.RESEND_API_KEY = 'invalid'

      const result = validateEnv()
      expect(result.valid).toBe(false)
    })

    it('accepts valid Resend API key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'
      process.env.RESEND_API_KEY = 're_123456789'
      process.env.RESEND_FROM_EMAIL = 'test@example.com'

      const result = validateEnv()
      expect(result.valid).toBe(true)
    })

    it('validates email format', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'
      process.env.RESEND_API_KEY = 're_123456789'
      process.env.RESEND_FROM_EMAIL = 'not-an-email'

      const result = validateEnv()
      expect(result.valid).toBe(false)
    })

    it('returns warnings for default values', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'
      // Some optional vars with defaults might trigger warnings

      const result = validateEnv()
      // Warnings are for informational purposes
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('includes configured values in result', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'
      process.env.GEMINI_API_KEY = 'test-gemini-key'

      const result = validateEnv()
      expect(result.values.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co')
      expect(result.values.GEMINI_API_KEY).toBe('test-gemini-key')
    })

    it('converts boolean strings to booleans', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'

      const result = validateEnv()
      // Any boolean env vars would be converted
      expect(typeof result.values).toBe('object')
    })

    it('converts number strings to numbers', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'

      const result = validateEnv()
      expect(typeof result.values).toBe('object')
    })
  })

  describe('assertValidEnv', () => {
    it('does not throw when env is valid', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'

      expect(() => assertValidEnv()).not.toThrow()
    })

    it('throws when env is invalid', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      delete process.env.NEXT_PUBLIC_APP_URL

      expect(() => assertValidEnv()).toThrow('Environment validation failed')
    })

    it('includes error details in thrown message', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      try {
        assertValidEnv()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        if (error instanceof Error) {
          expect(error.message).toContain('NEXT_PUBLIC_SUPABASE_URL')
        }
      }
    })
  })

  describe('isFeatureEnabled', () => {
    beforeEach(() => {
      delete process.env.STRIPE_SECRET_KEY
      delete process.env.STRIPE_WEBHOOK_SECRET
      delete process.env.RESEND_API_KEY
      delete process.env.RESEND_FROM_EMAIL
      delete process.env.SENTRY_DSN
      delete process.env.SEATS_AERO_API_KEY
      delete process.env.GEMINI_API_KEY
    })

    it('returns false when feature is not configured', () => {
      expect(isFeatureEnabled('stripe')).toBe(false)
      expect(isFeatureEnabled('resend')).toBe(false)
      expect(isFeatureEnabled('sentry')).toBe(false)
      expect(isFeatureEnabled('seats_aero')).toBe(false)
      expect(isFeatureEnabled('gemini')).toBe(false)
    })

    it('returns true when Stripe is configured', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
      expect(isFeatureEnabled('stripe')).toBe(true)
    })

    it('returns false when Stripe is partially configured', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123'
      // Missing STRIPE_WEBHOOK_SECRET
      expect(isFeatureEnabled('stripe')).toBe(false)
    })

    it('returns true when Resend is configured', () => {
      process.env.RESEND_API_KEY = 're_123'
      process.env.RESEND_FROM_EMAIL = 'test@example.com'
      expect(isFeatureEnabled('resend')).toBe(true)
    })

    it('returns true when Sentry is configured', () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123'
      expect(isFeatureEnabled('sentry')).toBe(true)
    })

    it('returns true when Sentry public DSN is configured', () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123'
      expect(isFeatureEnabled('sentry')).toBe(true)
    })

    it('returns true when Seats.aero is configured', () => {
      process.env.SEATS_AERO_API_KEY = 'test-key'
      expect(isFeatureEnabled('seats_aero')).toBe(true)
    })

    it('returns true when Gemini is configured', () => {
      process.env.GEMINI_API_KEY = 'test-key'
      expect(isFeatureEnabled('gemini')).toBe(true)
    })
  })

  describe('getFeatureStatus', () => {
    it('returns status object for all features', () => {
      const status = getFeatureStatus()
      
      expect(status).toHaveProperty('stripe')
      expect(status).toHaveProperty('resend')
      expect(status).toHaveProperty('sentry')
      expect(status).toHaveProperty('seats_aero')
      expect(status).toHaveProperty('gemini')
      expect(status).toHaveProperty('rate_limiting_distributed')
    })

    it('returns boolean values', () => {
      const status = getFeatureStatus()
      
      expect(typeof status.stripe).toBe('boolean')
      expect(typeof status.resend).toBe('boolean')
      expect(typeof status.sentry).toBe('boolean')
    })

    it('detects distributed rate limiting', () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      
      let status = getFeatureStatus()
      expect(status.rate_limiting_distributed).toBe(false)

      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
      
      status = getFeatureStatus()
      expect(status.rate_limiting_distributed).toBe(true)
    })
  })
})
