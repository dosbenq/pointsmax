import { describe, expect, it } from 'vitest'
import {
  apiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  payloadTooLarge,
  rateLimited,
  internalError,
  serviceUnavailable,
} from './error-utils'

describe('error-utils', () => {
  describe('apiError', () => {
    it('creates error with correct code and message', async () => {
      const response = apiError('BAD_REQUEST', 'Invalid input', 400)
      const body = await response.json()

      expect(body.error.code).toBe('BAD_REQUEST')
      expect(body.error.message).toBe('Invalid input')
    })

    it('includes custom headers', () => {
      const response = apiError('RATE_LIMITED', 'Too many requests', 429, {
        'Retry-After': '60',
        'X-Custom-Header': 'test',
      })

      expect(response.headers.get('Retry-After')).toBe('60')
      expect(response.headers.get('X-Custom-Header')).toBe('test')
    })

    it('has correct status code', () => {
      const response = apiError('NOT_FOUND', 'Not found', 404)
      expect(response.status).toBe(404)
    })
  })

  describe('badRequest', () => {
    it('creates 400 error', async () => {
      const response = badRequest('Missing field')
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error.code).toBe('BAD_REQUEST')
      expect(body.error.message).toBe('Missing field')
    })
  })

  describe('unauthorized', () => {
    it('creates 401 error with default message', async () => {
      const response = unauthorized()
      expect(response.status).toBe(401)

      const body = await response.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
      expect(body.error.message).toBe('Unauthorized')
    })

    it('accepts custom message', async () => {
      const response = unauthorized('Token expired')

      const body = await response.json()
      expect(body.error.message).toBe('Token expired')
    })
  })

  describe('forbidden', () => {
    it('creates 403 error with default message', async () => {
      const response = forbidden()
      expect(response.status).toBe(403)

      const body = await response.json()
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.message).toBe('Forbidden')
    })

    it('accepts custom message', async () => {
      const response = forbidden('Insufficient permissions')

      const body = await response.json()
      expect(body.error.message).toBe('Insufficient permissions')
    })
  })

  describe('notFound', () => {
    it('creates 404 error with resource name', async () => {
      const response = notFound('User not found')
      expect(response.status).toBe(404)

      const body = await response.json()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toBe('User not found')
    })
  })

  describe('conflict', () => {
    it('creates 409 error', async () => {
      const response = conflict('Resource already exists')
      expect(response.status).toBe(409)

      const body = await response.json()
      expect(body.error.code).toBe('CONFLICT')
      expect(body.error.message).toBe('Resource already exists')
    })
  })

  describe('payloadTooLarge', () => {
    it('creates 413 error with size info', async () => {
      const response = payloadTooLarge(10000)
      expect(response.status).toBe(413)

      const body = await response.json()
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE')
      expect(body.error.message).toContain('10000')
    })
  })

  describe('rateLimited', () => {
    it('creates 429 error with Retry-After header', async () => {
      const response = rateLimited(60)
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('60')

      const body = await response.json()
      expect(body.error.code).toBe('RATE_LIMITED')
    })
  })

  describe('internalError', () => {
    it('creates 500 error with default message', async () => {
      const response = internalError()
      expect(response.status).toBe(500)

      const body = await response.json()
      expect(body.error.code).toBe('INTERNAL_ERROR')
      expect(body.error.message).toBe('Internal error')
    })

    it('accepts custom message', async () => {
      const response = internalError('Database connection failed')

      const body = await response.json()
      expect(body.error.message).toBe('Database connection failed')
    })
  })

  describe('serviceUnavailable', () => {
    it('creates 503 error', async () => {
      const response = serviceUnavailable('Service temporarily unavailable')
      expect(response.status).toBe(503)

      const body = await response.json()
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE')
      expect(body.error.message).toBe('Service temporarily unavailable')
    })
  })

  describe('error response structure', () => {
    it('always returns JSON with error object', async () => {
      const response = badRequest('Test')
      expect(response.headers.get('Content-Type')).toContain('application/json')

      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('code')
      expect(body.error).toHaveProperty('message')
    })
  })
})
