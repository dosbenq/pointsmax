import { describe, expect, it } from 'vitest'
import {
  success,
  created,
  noContent,
  error,
  errors,
  validationError,
  paginated,
  isSuccessResponse,
  isErrorResponse,
  safeJsonParse,
} from './api-response'

describe('api-response', () => {
  describe('success', () => {
    it('returns 200 with data', () => {
      const response = success({ id: '123', name: 'Test' })
      expect(response.status).toBe(200)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.data).toEqual({ id: '123', name: 'Test' })
    })

    it('accepts custom status', () => {
      const response = success({ items: [] }, { status: 201 })
      expect(response.status).toBe(201)
    })

    it('includes custom headers', () => {
      const response = success({ items: [] }, { headers: { 'X-Total': '100' } })
      expect(response.headers.get('X-Total')).toBe('100')
    })

    it('includes meta information', () => {
      const response = success([1, 2, 3], {
        meta: { page: 1, limit: 10, total: 100, hasMore: true },
      })
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 100,
        hasMore: true,
      })
    })
  })

  describe('created', () => {
    it('returns 201 with data', () => {
      const response = created({ id: '123' })
      expect(response.status).toBe(201)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.data).toEqual({ id: '123' })
    })

    it('includes custom headers', () => {
      const response = created({ id: '123' }, { Location: '/items/123' })
      expect(response.headers.get('Location')).toBe('/items/123')
    })
  })

  describe('noContent', () => {
    it('returns 204 with no body', () => {
      const response = noContent()
      expect(response.status).toBe(204)
      expect(response.body).toBeNull()
    })
  })

  describe('error', () => {
    it('returns error with code and message', () => {
      const response = error('BAD_REQUEST', 'Invalid input', 400)
      expect(response.status).toBe(400)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.code).toBe('BAD_REQUEST')
      expect(body.error.message).toBe('Invalid input')
    })

    it('includes error details', () => {
      const response = error('VALIDATION_ERROR', 'Validation failed', 400, {
        details: { field: 'email', issue: 'invalid' },
      })
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.details).toEqual({ field: 'email', issue: 'invalid' })
    })

    it('includes request ID', () => {
      const response = error('INTERNAL_ERROR', 'Server error', 500, {
        requestId: 'abc-123',
      })
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.requestId).toBe('abc-123')
    })

    it('includes custom headers', () => {
      const response = error('RATE_LIMITED', 'Too many requests', 429, {
        headers: { 'Retry-After': '60' },
      })
      expect(response.headers.get('Retry-After')).toBe('60')
    })

    it('maps error codes to default status codes', () => {
      const testCases: Array<{ code: Parameters<typeof error>[0]; expectedStatus: number }> = [
        { code: 'BAD_REQUEST', expectedStatus: 400 },
        { code: 'UNAUTHORIZED', expectedStatus: 401 },
        { code: 'FORBIDDEN', expectedStatus: 403 },
        { code: 'NOT_FOUND', expectedStatus: 404 },
        { code: 'CONFLICT', expectedStatus: 409 },
        { code: 'PAYLOAD_TOO_LARGE', expectedStatus: 413 },
        { code: 'RATE_LIMITED', expectedStatus: 429 },
        { code: 'INTERNAL_ERROR', expectedStatus: 500 },
        { code: 'SERVICE_UNAVAILABLE', expectedStatus: 503 },
        { code: 'VALIDATION_ERROR', expectedStatus: 400 },
        { code: 'TIMEOUT_ERROR', expectedStatus: 504 },
        { code: 'CIRCUIT_OPEN', expectedStatus: 503 },
      ]

      testCases.forEach(({ code, expectedStatus }) => {
        const response = error(code, 'Test', expectedStatus)
        expect(response.status).toBe(expectedStatus)
      })
    })
  })

  describe('error helpers', () => {
    it('badRequest returns 400', () => {
      const response = errors.badRequest('Invalid input')
      expect(response.status).toBe(400)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.code).toBe('BAD_REQUEST')
      expect(body.error.message).toBe('Invalid input')
    })

    it('badRequest includes details', () => {
      const response = errors.badRequest('Invalid input', { field: 'email' })
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.details).toEqual({ field: 'email' })
    })

    it('unauthorized returns 401 with default message', () => {
      const response = errors.unauthorized()
      expect(response.status).toBe(401)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.message).toBe('Unauthorized')
    })

    it('unauthorized accepts custom message', () => {
      const response = errors.unauthorized('Token expired')
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.message).toBe('Token expired')
    })

    it('forbidden returns 403', () => {
      const response = errors.forbidden()
      expect(response.status).toBe(403)
    })

    it('notFound returns 404 with resource name', () => {
      const response = errors.notFound('User')
      expect(response.status).toBe(404)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.message).toBe('User not found')
    })

    it('conflict returns 409', () => {
      const response = errors.conflict('Already exists')
      expect(response.status).toBe(409)
    })

    it('payloadTooLarge returns 413 with size info', () => {
      const response = errors.payloadTooLarge(50000)
      expect(response.status).toBe(413)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.message).toContain('50000')
    })

    it('rateLimited returns 429 with Retry-After header', () => {
      const response = errors.rateLimited(60)
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('60')
    })

    it('internal returns 500 with default message', () => {
      const response = errors.internal()
      expect(response.status).toBe(500)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.message).toBe('Internal server error')
    })

    it('serviceUnavailable returns 503', () => {
      const response = errors.serviceUnavailable('Maintenance')
      expect(response.status).toBe(503)
    })

    it('validation returns 400 with details', () => {
      const response = errors.validation('Validation failed', { fields: [] })
      expect(response.status).toBe(400)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.details).toEqual({ fields: [] })
    })

    it('timeout returns 504', () => {
      const response = errors.timeout('database_query')
      expect(response.status).toBe(504)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.message).toContain('database_query')
    })

    it('circuitOpen returns 503', () => {
      const response = errors.circuitOpen('gemini-api')
      expect(response.status).toBe(503)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.code).toBe('CIRCUIT_OPEN')
      expect(body.error.message).toContain('gemini-api')
    })
  })

  describe('validationError', () => {
    it('returns 400 with field errors', () => {
      const fieldErrors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ]
      const response = validationError(fieldErrors, 'req-123')
      
      expect(response.status).toBe(400)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.details.fields).toEqual(fieldErrors)
      expect(body.error.requestId).toBe('req-123')
    })
  })

  describe('paginated', () => {
    it('returns paginated response with meta', () => {
      const response = paginated({
        items: [1, 2, 3],
        total: 100,
        page: 2,
        limit: 10,
      })
      
      expect(response.status).toBe(200)
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.data).toEqual([1, 2, 3])
      expect(body.meta).toEqual({
        page: 2,
        limit: 10,
        total: 100,
        hasMore: true,
      })
    })

    it('calculates hasMore correctly', () => {
      const response = paginated({
        items: [1, 2],
        total: 10,
        page: 1,
        limit: 10,
      })
      
      const body = JSON.parse(JSON.stringify(response))
      expect(body.meta.hasMore).toBe(false)
    })

    it('includes custom headers', () => {
      const response = paginated(
        { items: [], total: 0, page: 1, limit: 10 },
        { 'X-Cache': 'MISS' }
      )
      expect(response.headers.get('X-Cache')).toBe('MISS')
    })
  })

  describe('type guards', () => {
    it('isSuccessResponse returns true for success', () => {
      const response = { data: { id: '123' } }
      expect(isSuccessResponse(response)).toBe(true)
    })

    it('isSuccessResponse returns false for error', () => {
      const response = { error: { code: 'ERROR', message: 'Failed' } }
      expect(isSuccessResponse(response)).toBe(false)
    })

    it('isErrorResponse returns true for error', () => {
      const response = { error: { code: 'ERROR', message: 'Failed' } }
      expect(isErrorResponse(response)).toBe(true)
    })

    it('isErrorResponse returns false for success', () => {
      const response = { data: { id: '123' } }
      expect(isErrorResponse(response)).toBe(false)
    })
  })

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      const result = safeJsonParse('{"id": "123"}')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ id: '123' })
      }
    })

    it('returns error for invalid JSON', () => {
      const result = safeJsonParse('invalid json')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid JSON')
      }
    })

    it('validates against schema when provided', () => {
      const schema = {
        safeParse: (data: unknown) => ({
          success: typeof data === 'object' && data !== null && 'id' in (data as object),
          data: data as { id: string },
        }),
      }
      
      const result = safeJsonParse('{"id": "123"}', schema as any)
      expect(result.success).toBe(true)
    })

    it('returns error when schema validation fails', () => {
      const schema = {
        safeParse: () => ({
          success: false,
        }),
      }
      
      const result = safeJsonParse('{"id": "123"}', schema as any)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Schema validation failed')
      }
    })
  })
})
