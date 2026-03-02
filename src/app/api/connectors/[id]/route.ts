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
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { emitAuditEvent, type AuditPersistence } from '@/lib/connectors/audit-log'
import { logInfo, logError } from '@/lib/logger'
import type { ConnectedAccount } from '@/types/connectors'
import { createAdminClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Audit persistence backed by Supabase
// ─────────────────────────────────────────────

function buildAuditPersistence(): AuditPersistence {
  return {
    async insert(event) {
      const admin = createAdminClient()
      await admin.from('connector_audit_log').insert({
        user_id: event.userId,
        account_id: event.accountId,
        provider: event.provider,
        event_type: event.eventType,
        actor: event.actor,
        metadata: event.metadata ?? null,
      })
    },
  }
}

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

  const supabase = await createSupabaseServerClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve internal user row id
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  const userId = (userRow as { id?: string } | null)?.id
  if (!userId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 404 })
  }

  // Fetch account to confirm ownership before deletion
  const { data: accountRow, error: accountErr } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (accountErr || !accountRow) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const account = accountRow as unknown as ConnectedAccount

  // Emit audit event BEFORE deletion so metadata is available.
  // The audit row's account_id will be set to NULL by ON DELETE SET NULL.
  await emitAuditEvent(buildAuditPersistence(), {
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
  const { error: deleteErr } = await supabase
    .from('connected_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId)

  if (deleteErr) {
    logError('connector_delete_failed', {
      accountId,
      provider: account.provider,
      error: deleteErr.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  logInfo('connector_deleted', { accountId, provider: account.provider, userId })

  return new NextResponse(null, { status: 204 })
}
