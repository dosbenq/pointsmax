import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { getSafeAppOrigin } from '@/lib/app-origin'
import { getSessionUser, getUserRowId } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import { sharedTrips } from '@/lib/db/schema'
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
  return crypto.randomBytes(12).toString('base64url')
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

  let createdBy: string | null = null
  try {
    const user = await getSessionUser()
    if (user) createdBy = await getUserRowId(user.id)
  } catch {
    createdBy = null
  }

  const id = newShareId()
  try {
    await getDb().insert(sharedTrips).values({
      id,
      region,
      tripData: body.trip_data,
      createdBy,
    })
  } catch (error) {
    logError('trip_share_insert_failed', { requestId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const appOrigin = getSafeAppOrigin(req.nextUrl.origin)
  const url = `${appOrigin}/${region}/trips/${id}`
  logInfo('trip_shared_created', { requestId, id, region, created_by: createdBy })
  return NextResponse.json({ ok: true, id, url })
}
