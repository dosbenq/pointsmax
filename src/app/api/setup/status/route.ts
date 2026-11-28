import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api-security'
import { getSetupStatus } from '@/lib/setup-status'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/setup/status — self-check for the move to Neon: settings present,
// schema applied, and a rehearsal of the Supabase copy (counts only).
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, { namespace: 'setup-status', windowMs: 60_000, maxRequests: 10 })
  if (limited) return limited

  const status = await getSetupStatus()
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}
