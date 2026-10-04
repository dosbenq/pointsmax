// ============================================================
// POST /api/connectors/disconnect
//
// Disconnects a connected loyalty account by:
//   1. Validating caller ownership (RLS + explicit user_id check)
//   2. Overwriting the encrypted token in token_vault_ref with a
//      sentinel value to destroy the credential material
//   3. Setting connected_accounts.status = 'revoked'
//   4. Emitting a connector_audit_log row for the event
//
// Request body: { account_id: string }
//
// Response:
//   200 { status: 'ok' }
//   400 { error: string }   — validation or already-revoked
//   401 { error: 'Unauthorized' }
//   404 { error: 'Account not found' }
//   500 { error: 'Internal error' }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSessionUser, getUserRowId } from '@/lib/auth'
import { UUID_RE } from '@/lib/auth-guard'
import { databaseAuditPersistence, emitAuditEvent } from '@/lib/connectors/audit-log'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { connectedAccounts } from '@/lib/db/schema'
import { logInfo, logError } from '@/lib/logger'
import type { ConnectedAccount } from '@/types/connectors'

// ─────────────────────────────────────────────
// Sentinel value written into token_vault_ref on revoke.
// It is not valid JSON so any attempt to decrypt it will
// throw TokenVaultDecryptError, preventing token re-use.
// ─────────────────────────────────────────────
const REVOKED_SENTINEL = 'REVOKED'

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth guard
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const accountId = (body as { account_id?: unknown })?.account_id
  if (typeof accountId !== 'string' || accountId.trim() === '') {
    return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
  }

  // Resolve internal user row id
  const userId = await getUserRowId(user.id)
  if (!userId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 404 })
  }
  if (!UUID_RE.test(accountId)) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Fetch connected account — explicit user_id check prevents cross-user access
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

  // Guard: already revoked accounts should not be double-processed
  if (account.status === 'revoked') {
    return NextResponse.json(
      { error: 'Account is already disconnected' },
      { status: 400 },
    )
  }

  // Destroy credential material and mark as revoked
  try {
    await getDb()
      .update(connectedAccounts)
      .set({
        tokenVaultRef: REVOKED_SENTINEL,
        status: 'revoked',
        syncStatus: 'error',
        lastError: 'Account disconnected by user',
        errorCode: null,
        updatedAt: new Date().toISOString(),
      })
      .where(ownAccount)
  } catch (updateErr) {
    logError('disconnect_update_failed', {
      accountId,
      provider: account.provider,
      error: updateErr instanceof Error ? updateErr.message : String(updateErr),
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  logInfo('connector_disconnected', { accountId, provider: account.provider, userId })

  // Emit audit event (non-blocking — does not throw on failure)
  await emitAuditEvent(databaseAuditPersistence(), {
    userId,
    accountId,
    provider: account.provider,
    eventType: 'disconnect',
    actor: 'user',
    metadata: {
      previousStatus: account.status,
    },
  })

  return NextResponse.json({ status: 'ok' })
}
