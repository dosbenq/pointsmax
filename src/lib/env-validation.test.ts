import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { isFeatureEnabled, getFeatureStatus } from './env-validation'

describe('env-validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
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
