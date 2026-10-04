import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getSessionUser, getUserRowId } from '@/lib/auth'
import { UUID_RE } from '@/lib/auth-guard'
import { getDb } from '@/lib/db/client'
import { userBalances } from '@/lib/db/schema'
import { badRequest, internalError } from '@/lib/error-utils'
import { logError, logInfo } from '@/lib/logger'

type ConfirmCandidate = {
  program_id: string
  balance: number
}

function validateCandidates(body: unknown): ConfirmCandidate[] | null {
  if (!body || typeof body !== 'object') return null
  const rawCandidates = (body as { candidates?: unknown }).candidates
  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) return null

  const candidates = rawCandidates
    .filter((row): row is { program_id: string; balance: number } => {
      if (!row || typeof row !== 'object') return false
      const record = row as Record<string, unknown>
      return typeof record.program_id === 'string' && UUID_RE.test(record.program_id) && Number(record.balance) > 0
    })
    .map((row) => ({
      program_id: row.program_id,
      balance: Math.max(0, Math.floor(Number(row.balance))),
    }))

  return candidates.length > 0 ? candidates : null
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  const user = await getSessionUser()

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

  const userId = await getUserRowId(user.id)
  if (!userId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 404 })
  }

  try {
    const rows = candidates.map((candidate) => ({
      userId,
      programId: candidate.program_id,
      balance: candidate.balance,
      updatedAt: new Date().toISOString(),
    }))

    await getDb()
      .insert(userBalances)
      .values(rows)
      .onConflictDoUpdate({
        target: [userBalances.userId, userBalances.programId],
        set: { balance: sql`excluded.balance`, updatedAt: sql`excluded.updated_at` },
      })

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
