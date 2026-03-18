import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { badRequest, internalError } from '@/lib/error-utils'
import { logError, logInfo } from '@/lib/logger'

type ConfirmCandidate = {
  program_id: string
  balance: number
}

async function getCurrentUserRowId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authId: string,
): Promise<string | null> {
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .single()

  const id = (userRecord as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : null
}

function validateCandidates(body: unknown): ConfirmCandidate[] | null {
  if (!body || typeof body !== 'object') return null
  const rawCandidates = (body as { candidates?: unknown }).candidates
  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) return null

  const candidates = rawCandidates
    .filter((row): row is { program_id: string; balance: number } => {
      if (!row || typeof row !== 'object') return false
      const record = row as Record<string, unknown>
      return typeof record.program_id === 'string' && Number(record.balance) > 0
    })
    .map((row) => ({
      program_id: row.program_id,
      balance: Math.max(0, Math.floor(Number(row.balance))),
    }))

  return candidates.length > 0 ? candidates : null
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  const candidates = validateCandidates(body)
  if (!candidates) {
    return badRequest('At least one matched candidate is required')
  }

  const userId = await getCurrentUserRowId(supabase, user.id)
  if (!userId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 404 })
  }

  try {
    const rows = candidates.map((candidate) => ({
      user_id: userId,
      program_id: candidate.program_id,
      balance: candidate.balance,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('user_balances')
      .upsert(rows, { onConflict: 'user_id,program_id' })

    if (error) {
      throw new Error(error.message)
    }

    logInfo('ingest_confirm_saved', {
      requestId,
      authUserId: user.id,
      candidateCount: rows.length,
    })

    return NextResponse.json({
      ok: true,
      saved_count: rows.length,
    })
  } catch (error) {
    logError('ingest_confirm_failed', {
      requestId,
      authUserId: user.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return internalError('Failed to save imported balances')
  }
}
