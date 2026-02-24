import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { applySecurityHeaders } from '@/lib/security-headers'

const CORS_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
const CORS_HEADERS = 'Content-Type, Authorization, X-Requested-With, X-Request-Id'
const CREATOR_REF_COOKIE = 'pm_creator_ref'
const CREATOR_REF_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getAllowedCorsOrigins(): Set<string> {
  const origins = new Set<string>()
  const appOrigin = toOrigin(process.env.NEXT_PUBLIC_APP_URL ?? '')
  if (appOrigin) origins.add(appOrigin)

  const raw = process.env.CORS_ALLOWED_ORIGINS ?? ''
  for (const part of raw.split(',')) {
    const normalized = toOrigin(part.trim())
    if (normalized) origins.add(normalized)
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }
  return origins
}

const ALLOWED_CORS_ORIGINS = getAllowedCorsOrigins()

function normalizeCreatorSlug(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  if (!/^[a-z0-9-]{2,64}$/.test(trimmed)) return null
  return trimmed
}

function applyCreatorRefCookie(response: NextResponse, creatorSlug: string | null) {
  if (!creatorSlug) return
  response.cookies.set({
    name: CREATOR_REF_COOKIE,
    value: creatorSlug,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CREATOR_REF_MAX_AGE_SECONDS,
  })
}

function appendCorsHeaders(
  response: NextResponse,
  requestOrigin: string | null,
  includeCredentials = true,
): void {
  if (!requestOrigin) return
  if (!ALLOWED_CORS_ORIGINS.has(requestOrigin)) return

  response.headers.set('Access-Control-Allow-Origin', requestOrigin)
  response.headers.set('Access-Control-Allow-Methods', CORS_METHODS)
  response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS)
  response.headers.set('Access-Control-Max-Age', '86400')
  response.headers.set('Vary', 'Origin')
  if (includeCredentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const requestOrigin = request.headers.get('origin')
  const creatorSlug = normalizeCreatorSlug(request.nextUrl.searchParams.get('ref'))
  const requestId =
    request.headers.get('x-request-id') ??
    request.headers.get('x-vercel-id') ??
    crypto.randomUUID()
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('x-request-id', requestId)

  if (pathname.startsWith('/api/')) {
    if (request.method === 'OPTIONS') {
      if (requestOrigin && !ALLOWED_CORS_ORIGINS.has(requestOrigin)) {
        const denied = NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
        denied.headers.set('x-request-id', requestId)
        applyCreatorRefCookie(denied, creatorSlug)
        return applySecurityHeaders(denied)
      }
      const preflight = new NextResponse(null, { status: 204 })
      appendCorsHeaders(preflight, requestOrigin, true)
      preflight.headers.set('x-request-id', requestId)
      applyCreatorRefCookie(preflight, creatorSlug)
      return preflight
    }

    const response = NextResponse.next({ request: { headers: forwardedHeaders } })
    appendCorsHeaders(response, requestOrigin, true)
    response.headers.set('x-request-id', requestId)
    applyCreatorRefCookie(response, creatorSlug)
    return applySecurityHeaders(response)
  }

  let supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — keeps user logged in across tab closes
  try {
    await supabase.auth.getUser()
  } catch {
    // Non-blocking: page requests should still load even if auth backend is unavailable.
  }

  supabaseResponse.headers.set('x-request-id', requestId)

  // ── Regional Redirection Logic ────────────────────────────────
  // Redirect / to /us or /in based on IP country
  if (pathname === '/') {
    const country = request.headers.get('x-vercel-ip-country')?.toUpperCase()
    const region = country === 'IN' ? 'in' : 'us'
    const url = request.nextUrl.clone()
    url.pathname = `/${region}`
    const redirect = NextResponse.redirect(url)
    applyCreatorRefCookie(redirect, creatorSlug)
    return applySecurityHeaders(redirect)
  }

  applyCreatorRefCookie(supabaseResponse, creatorSlug)
  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
