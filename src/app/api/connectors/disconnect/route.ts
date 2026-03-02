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
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { emitAuditEvent, type AuditPersistence } from '@/lib/connectors/audit-log'
import { logInfo, logError } from '@/lib/logger'
import type { ConnectedAccount } from '@/types/connectors'
import { createAdminClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Sentinel value written into token_vault_ref on revoke.
// It is not valid JSON so any attempt to decrypt it will
// throw TokenVaultDecryptError, preventing token re-use.
// ─────────────────────────────────────────────
const REVOKED_SENTINEL = 'REVOKED'

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

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  const userId = (userRow as { id?: string } | null)?.id
  if (!userId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 404 })
  }

  // Fetch connected account — explicit user_id check prevents cross-user access
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

  // Guard: already revoked accounts should not be double-processed
  if (account.status === 'revoked') {
    return NextResponse.json(
      { error: 'Account is already disconnected' },
      { status: 400 },
    )
  }

  // Destroy credential material and mark as revoked
  const { error: updateErr } = await supabase
    .from('connected_accounts')
    .update({
      token_vault_ref: REVOKED_SENTINEL,
      status: 'revoked',
      sync_status: 'error',
      last_error: 'Account disconnected by user',
      error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
    .eq('user_id', userId)

  if (updateErr) {
    logError('disconnect_update_failed', {
      accountId,
      provider: account.provider,
      error: updateErr.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  logInfo('connector_disconnected', { accountId, provider: account.provider, userId })

  // Emit audit event (non-blocking — does not throw on failure)
  await emitAuditEvent(buildAuditPersistence(), {
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
