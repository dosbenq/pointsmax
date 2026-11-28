// Better Auth endpoints: sign-in start, Google callback
// (/api/auth/callback/google), session and sign-out.
import { NextResponse } from 'next/server'
import { toNextJsHandler } from 'better-auth/next-js'
import { getAuth } from '@/lib/auth'
import { ensureDatabaseReady } from '@/lib/db/ready'
import { hasDatabaseUrl } from '@/lib/db/url'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function handle(request: Request, method: 'GET' | 'POST') {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: 'Sign-in is not configured' }, { status: 503 })
  }
  try {
    // Sign-in writes profiles, so it needs the schema in place.
    await ensureDatabaseReady()
  } catch (error) {
    logError('auth_database_not_ready', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Sign-in is temporarily unavailable' }, { status: 503 })
  }
  return toNextJsHandler(getAuth())[method](request)
}

export async function GET(request: Request) {
  return handle(request, 'GET')
}

export async function POST(request: Request) {
  return handle(request, 'POST')
}
