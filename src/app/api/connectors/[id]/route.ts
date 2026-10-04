// ============================================================
// DELETE /api/connectors/[id]
//
// Hard-deletes a connected loyalty account and all its
// balance snapshots (via ON DELETE CASCADE in migration 027).
//
// Security requirements:
//   1. Caller must be authenticated.
//   2. Explicit user_id equality check prevents cross-user
//      deletion even if RLS is misconfigured.
//   3. Audit event is emitted BEFORE the hard delete so that
//      account metadata is still available for the log row.
//      (The audit row survives via ON DELETE SET NULL on account_id.)
//
// Response:
//   204 (no body)           — deleted successfully
//   401 { error: string }   — not authenticated
//   404 { error: string }   — account not found or not owned by caller
//   500 { error: string }   — internal failure
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireProfile, UUID_RE } from '@/lib/auth-guard'
import { databaseAuditPersistence, emitAuditEvent } from '@/lib/connectors/audit-log'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { connectedAccounts } from '@/lib/db/schema'
import { logInfo, logError } from '@/lib/logger'
import type { ConnectedAccount } from '@/types/connectors'

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params

  if (!accountId || accountId.trim() === '') {
    return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
  }

  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { userId } = auth

  if (!UUID_RE.test(accountId)) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Fetch account to confirm ownership before deletion
  const ownAccount = and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId))
  const [accountRow] = await getDb()
    .select(columnsOf(connectedAccounts))
    .from(connectedAccounts)
    .where(ownAccount)
    .limit(1)

  if (!accountRow) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const account = accountRow as unknown as ConnectedAccount

  // Emit audit event BEFORE deletion so metadata is available.
  // The audit row's account_id will be set to NULL by ON DELETE SET NULL.
  await emitAuditEvent(databaseAuditPersistence(), {
    userId,
    accountId,
    provider: account.provider,
    eventType: 'delete',
    actor: 'user',
    metadata: {
      previousStatus: account.status,
      displayName: account.display_name,
    },
  })

  // Hard delete — balance_snapshots are removed via CASCADE
  try {
    await getDb().delete(connectedAccounts).where(ownAccount)
  } catch (deleteErr) {
    logError('connector_delete_failed', {
      accountId,
      provider: account.provider,
      error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr),
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  logInfo('connector_deleted', { accountId, provider: account.provider, userId })

  return new NextResponse(null, { status: 204 })
}
