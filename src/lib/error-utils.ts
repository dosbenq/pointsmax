import { NextResponse } from 'next/server'

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

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode
    message: string
  }
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  headers?: Record<string, string>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers }
  )
}

// Common error factories
export function badRequest(message: string): NextResponse<ApiErrorResponse> {
  return apiError('BAD_REQUEST', message, 400)
}

export function unauthorized(message = 'Unauthorized'): NextResponse<ApiErrorResponse> {
  return apiError('UNAUTHORIZED', message, 401)
}

export function forbidden(message = 'Forbidden'): NextResponse<ApiErrorResponse> {
  return apiError('FORBIDDEN', message, 403)
}

export function notFound(message: string): NextResponse<ApiErrorResponse> {
  return apiError('NOT_FOUND', message, 404)
}

export function conflict(message: string): NextResponse<ApiErrorResponse> {
  return apiError('CONFLICT', message, 409)
}

export function payloadTooLarge(maxBytes: number): NextResponse<ApiErrorResponse> {
  return apiError('PAYLOAD_TOO_LARGE', `Payload too large. Max ${maxBytes} bytes.`, 413)
}

export function rateLimited(retryAfterSeconds: number): NextResponse<ApiErrorResponse> {
  return apiError(
    'RATE_LIMITED',
    'Too many requests. Please try again shortly.',
    429,
    { 'Retry-After': String(retryAfterSeconds) }
  )
}

export function internalError(message = 'Internal error'): NextResponse<ApiErrorResponse> {
  return apiError('INTERNAL_ERROR', message, 500)
}

export function serviceUnavailable(message: string): NextResponse<ApiErrorResponse> {
  return apiError('SERVICE_UNAVAILABLE', message, 503)
}
