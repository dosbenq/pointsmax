/**
 * Type-Safe API Response Helpers
 * Ensures consistent, type-safe responses across all API routes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

// ============================================================================
// Response Types
// ============================================================================

export type ApiSuccessResponse<T> = {
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'CIRCUIT_OPEN'

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
    requestId?: string
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================================================
// Success Response Helpers
// ============================================================================

export function success<T>(
  data: T,
  options?: {
    status?: number
    headers?: Record<string, string>
    meta?: ApiSuccessResponse<T>['meta']
  }
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = { data }
  if (options?.meta) {
    body.meta = options.meta
  }

  return NextResponse.json(body, {
    status: options?.status ?? 200,
    headers: options?.headers,
  })
}

export function created<T>(
  data: T,
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T>> {
  return success(data, { status: 201, headers })
}

export function noContent(): NextResponse<null> {
  return new NextResponse(null, { status: 204 })
}

// ============================================================================
// Error Response Helpers
// ============================================================================

export function error(
  code: ApiErrorCode,
  message: string,
  options?: {
    status?: number
    details?: unknown
    requestId?: string
    headers?: Record<string, string>
  }
): NextResponse<ApiErrorResponse> {
  const statusMap: Record<ApiErrorCode, number> = {
    'BAD_REQUEST': 400,
    'UNAUTHORIZED': 401,
    'FORBIDDEN': 403,
    'NOT_FOUND': 404,
    'CONFLICT': 409,
    'PAYLOAD_TOO_LARGE': 413,
    'RATE_LIMITED': 429,
    'INTERNAL_ERROR': 500,
    'SERVICE_UNAVAILABLE': 503,
    'VALIDATION_ERROR': 400,
    'TIMEOUT_ERROR': 504,
    'CIRCUIT_OPEN': 503,
  }

  const body: ApiErrorResponse = {
    error: {
      code,
      message,
    },
  }

  if (options?.details) {
    body.error.details = options.details
  }

  if (options?.requestId) {
    body.error.requestId = options.requestId
  }

  return NextResponse.json(body, {
    status: options?.status ?? statusMap[code] ?? 500,
    headers: options?.headers,
  })
}

// Convenience methods
export const errors = {
  badRequest: (message: string, details?: unknown) =>
    error('BAD_REQUEST', message, { details }),

  unauthorized: (message = 'Unauthorized') =>
    error('UNAUTHORIZED', message),

  forbidden: (message = 'Forbidden') =>
    error('FORBIDDEN', message),

  notFound: (resource: string) =>
    error('NOT_FOUND', `${resource} not found`),

  conflict: (message: string) =>
    error('CONFLICT', message),

  payloadTooLarge: (maxBytes: number) =>
    error('PAYLOAD_TOO_LARGE', `Payload too large. Max ${maxBytes} bytes.`),

  rateLimited: (retryAfterSeconds: number) =>
    error('RATE_LIMITED', 'Too many requests. Please try again shortly.', {
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }),

  internal: (message = 'Internal server error') =>
    error('INTERNAL_ERROR', message),

  serviceUnavailable: (message: string) =>
    error('SERVICE_UNAVAILABLE', message),

  validation: (message: string, details?: unknown) =>
    error('VALIDATION_ERROR', message, { details }),

  timeout: (operation: string) =>
    error('TIMEOUT_ERROR', `Operation '${operation}' timed out`),

  circuitOpen: (service: string) =>
    error('CIRCUIT_OPEN', `Service '${service}' is temporarily unavailable`),
}

// ============================================================================
// Validation Response Helper
// ============================================================================

export function validationError(
  fieldErrors: Array<{ field: string; message: string }>,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return error('VALIDATION_ERROR', 'Validation failed', {
    details: { fields: fieldErrors },
    requestId,
  })
}

// ============================================================================
// Response Type Guards
// ============================================================================

export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return 'data' in response
}

export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiErrorResponse {
  return 'error' in response
}

// ============================================================================
// Safe JSON Parsing
// ============================================================================

export function safeJsonParse<T>(
  text: string,
  schema?: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(text)

    if (schema) {
      const result = schema.safeParse(parsed)
      if (!result.success) {
        return { success: false, error: 'Schema validation failed' }
      }
      return { success: true, data: result.data }
    }

    return { success: true, data: parsed }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown parse error'
    return {
      success: false,
      error: `Invalid JSON: ${message}`,
    }
  }
}

// ============================================================================
// Paginated Response Helper
// ============================================================================

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export function paginated<T>(
  data: PaginatedData<T>,
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T[]>> {
  return success(data.items, {
    headers,
    meta: {
      page: data.page,
      limit: data.limit,
      total: data.total,
      hasMore: data.page * data.limit < data.total,
    },
  })
}
