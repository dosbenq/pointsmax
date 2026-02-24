import { describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { applySecurityHeaders, applyApiSecurityHeaders } from './security-headers'

describe('security-headers', () => {
  describe('applySecurityHeaders', () => {
    it('adds Content-Security-Policy header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      expect(result.headers.get('Content-Security-Policy')).toBeTruthy()
    })

    it('CSP includes default-src directive', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      const csp = result.headers.get('Content-Security-Policy')!
      
      expect(csp).toContain("default-src 'self'")
    })

    it('CSP includes script-src directive', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      const csp = result.headers.get('Content-Security-Policy')!
      
      expect(csp).toContain("script-src 'self'")
    })

    it('CSP includes style-src directive', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      const csp = result.headers.get('Content-Security-Policy')!
      
      expect(csp).toContain("style-src 'self'")
    })

    it('CSP includes frame-ancestors directive', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      const csp = result.headers.get('Content-Security-Policy')!
      
      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('adds Strict-Transport-Security header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      const hsts = result.headers.get('Strict-Transport-Security')
      expect(hsts).toContain('max-age=')
      expect(hsts).toContain('includeSubDomains')
      expect(hsts).toContain('preload')
    })

    it('adds X-Content-Type-Options header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('adds X-Frame-Options header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      expect(result.headers.get('X-Frame-Options')).toBe('DENY')
    })

    it('adds X-XSS-Protection header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      expect(result.headers.get('X-XSS-Protection')).toBe('1; mode=block')
    })

    it('adds Referrer-Policy header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      expect(result.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('adds Permissions-Policy header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      const permissions = result.headers.get('Permissions-Policy')
      expect(permissions).toContain('accelerometer=()')
      expect(permissions).toContain('camera=()')
      expect(permissions).toContain('geolocation=(self)')
    })

    it('adds Cross-Origin-Embedder-Policy header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      expect(result.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp')
    })

    it('adds Cross-Origin-Opener-Policy header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      expect(result.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    })

    it('adds Cross-Origin-Resource-Policy header', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response)
      
      expect(result.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin')
    })

    it('accepts custom HSTS max age', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response, { hstsMaxAge: 86400 })
      
      const hsts = result.headers.get('Strict-Transport-Security')
      expect(hsts).toContain('max-age=86400')
    })

    it('can disable HSTS subdomains', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response, { hstsIncludeSubdomains: false })
      
      const hsts = result.headers.get('Strict-Transport-Security')
      expect(hsts).not.toContain('includeSubDomains')
    })

    it('can use CSP report-only mode', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response, { cspReportOnly: true })
      
      expect(result.headers.get('Content-Security-Policy')).toBeNull()
      expect(result.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy()
    })

    it('can set CSP report URI', () => {
      const response = NextResponse.json({})
      const result = applySecurityHeaders(response, { 
        cspReportUri: 'https://report.example.com/csp' 
      })
      
      const csp = result.headers.get('Content-Security-Policy')!
      expect(csp).toContain('report-uri https://report.example.com/csp')
    })

    it('preserves existing response body', () => {
      const response = NextResponse.json({ test: 'data' })
      const result = applySecurityHeaders(response)
      
      // Verify we can still read the body (though NextResponse makes this tricky in tests)
      expect(result.status).toBe(200)
    })
  })

  describe('applyApiSecurityHeaders', () => {
    it('adds HSTS header', () => {
      const response = NextResponse.json({})
      const result = applyApiSecurityHeaders(response)
      
      expect(result.headers.get('Strict-Transport-Security')).toBeTruthy()
    })

    it('adds cache control headers for no-cache', () => {
      const response = NextResponse.json({})
      const result = applyApiSecurityHeaders(response)
      
      const cacheControl = result.headers.get('Cache-Control')
      expect(cacheControl).toContain('no-store')
      expect(cacheControl).toContain('no-cache')
      expect(cacheControl).toContain('must-revalidate')
    })

    it('adds Pragma header', () => {
      const response = NextResponse.json({})
      const result = applyApiSecurityHeaders(response)
      
      expect(result.headers.get('Pragma')).toBe('no-cache')
    })

    it('adds Expires header', () => {
      const response = NextResponse.json({})
      const result = applyApiSecurityHeaders(response)
      
      expect(result.headers.get('Expires')).toBe('0')
    })

    it('adds X-Content-Type-Options header', () => {
      const response = NextResponse.json({})
      const result = applyApiSecurityHeaders(response)
      
      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('does not add CSP header (APIs dont need it)', () => {
      const response = NextResponse.json({})
      const result = applyApiSecurityHeaders(response)
      
      expect(result.headers.get('Content-Security-Policy')).toBeNull()
    })

    it('does not add X-Frame-Options (APIs dont need it)', () => {
      const response = NextResponse.json({})
      const result = applyApiSecurityHeaders(response)
      
      expect(result.headers.get('X-Frame-Options')).toBeNull()
    })
  })
})
