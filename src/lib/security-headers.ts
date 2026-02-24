/**
 * Security Headers Middleware
 * Adds comprehensive security headers to all responses
 */

import { NextResponse } from 'next/server'

export interface SecurityHeadersConfig {
  // Content Security Policy
  cspReportOnly?: boolean
  cspReportUri?: string

  // Frame options
  allowFramesFrom?: string[]

  // HSTS
  hstsMaxAge?: number
  hstsIncludeSubdomains?: boolean
  hstsPreload?: boolean

  // Referrer Policy
  referrerPolicy?: string
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  cspReportOnly: false,
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubdomains: true,
  hstsPreload: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
}

/**
 * Generate Content Security Policy
 */
function generateCSP(config: SecurityHeadersConfig): string {
  const directives: string[] = [
    // Default fallback
    "default-src 'self'",

    // Scripts - allow self and unsafe-inline for Next.js
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

    // Styles - allow self and inline styles
    "style-src 'self' 'unsafe-inline'",

    // Images - allow self, data URIs, and common image hosts
    "img-src 'self' data: blob: https:",

    // Fonts - allow self and data URIs
    "font-src 'self' data:",

    // Connect - allow API calls and analytics
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.sentry.io",

    // Frame ancestors - prevent clickjacking
    "frame-ancestors 'none'",

    // Form action - restrict form submissions
    "form-action 'self'",

    // Base URI - restrict base tag
    "base-uri 'self'",

    // Upgrade insecure requests
    'upgrade-insecure-requests',
  ]

  if (config.cspReportUri) {
    directives.push(`report-uri ${config.cspReportUri}`)
  }

  return directives.join('; ')
}

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = {}
): NextResponse {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  // Content Security Policy
  const cspHeader = generateCSP(mergedConfig)
  response.headers.set(
    mergedConfig.cspReportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    cspHeader
  )

  // Strict Transport Security (HSTS)
  const hstsValue = [
    `max-age=${mergedConfig.hstsMaxAge}`,
    mergedConfig.hstsIncludeSubdomains ? 'includeSubDomains' : '',
    mergedConfig.hstsPreload ? 'preload' : '',
  ].filter(Boolean).join('; ')
  response.headers.set('Strict-Transport-Security', hstsValue)

  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY')

  // X-XSS-Protection (legacy but still useful)
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer Policy
  response.headers.set('Referrer-Policy', mergedConfig.referrerPolicy!)

  // Permissions Policy (formerly Feature Policy)
  response.headers.set(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'camera=()',
      'geolocation=(self)',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=(self)',
      'usb=()',
    ].join(', ')
  )

  // Cross-Origin Embedder Policy
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')

  // Cross-Origin Opener Policy
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')

  // Cross-Origin Resource Policy
  response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')

  return response
}

/**
 * Security headers for API routes (less strict than page routes)
 */
export function applyApiSecurityHeaders(response: NextResponse): NextResponse {
  // HSTS
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )

  // Prevent caching of sensitive API responses
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  // Content type options
  response.headers.set('X-Content-Type-Options', 'nosniff')

  return response
}
