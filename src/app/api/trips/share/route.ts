import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getRequestId, logError, logInfo } from '@/lib/logger'

const MAX_BODY_BYTES = 120_000

type ShareBody = {
  region?: unknown
  trip_data?: unknown
}

function normalizeRegion(value: unknown): 'us' | 'in' {
  return value === 'in' ? 'in' : 'us'
}

function newShareId(): string {
  return crypto.randomBytes(5).toString('base64url')
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError

  const rateLimitError = await enforceRateLimit(req, {
    namespace: 'share_trip_ip',
    maxRequests: 60,
    windowMs: 10 * 60 * 1000,
  })
  if (rateLimitError) return rateLimitError

  let body: ShareBody
  try {
    body = (await req.json()) as ShareBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const region = normalizeRegion(body.region)
  if (!body.trip_data || typeof body.trip_data !== 'object') {
    return NextResponse.json({ error: 'trip_data is required' }, { status: 400 })
  }

  const db = createAdminClient()
  let createdBy: string | null = null
  try {
    const supabase = await createSupabaseServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const authUserId = authData.user?.id ?? null
    if (authUserId) {
      const { data: userRow } = await db
        .from('users')
        .select('id')
        .eq('auth_id', authUserId)
        .maybeSingle()
      createdBy = userRow?.id ?? null
    }
  } catch {
    createdBy = null
  }

  const id = newShareId()
  const { error } = await db.from('shared_trips').insert({
    id,
    region,
    trip_data: body.trip_data,
    created_by: createdBy,
  })

  if (error) {
    logError('trip_share_insert_failed', { requestId, error: error.message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000'
  const url = `${appOrigin}/${region}/trips/${id}`
  logInfo('trip_shared_created', { requestId, id, region, created_by: createdBy })
  return NextResponse.json({ ok: true, id, url })
}
