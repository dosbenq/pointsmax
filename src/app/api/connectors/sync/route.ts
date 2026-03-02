// ============================================================
// POST /api/connectors/sync
//
// Triggers an on-demand balance sync for one of the calling
// user's connected accounts.
//
// Request body: { account_id: string }
//
// Response:
//   200 { status: 'ok',         result: FetchBalanceResult }
//   200 { status: 'auth_error', message: string }
//   200 { status: 'error',      errorCode: string, message: string }
//   400 { error: string }        — validation failure
//   401 { error: 'Unauthorized' }
//   404 { error: 'Account not found' }
//   500 { error: 'Internal error' }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { connectorRegistry } from '@/lib/connectors/connector-registry'
import { decryptToken } from '@/lib/connectors/token-vault'
import { runAccountSync, type SyncPersistence } from '@/lib/connectors/sync-orchestrator'
import { isAccountStale } from '@/lib/connectors/sync-orchestrator'
import { logInfo, logError } from '@/lib/logger'
import type { ConnectedAccount, SyncErrorCode } from '@/types/connectors'
import { emitAuditEvent, type AuditPersistence } from '@/lib/connectors/audit-log'
import { createAdminClient } from '@/lib/supabase'
import { ensureConnectorRegistryInitialized } from '@/lib/connectors/adapters'

// ─────────────────────────────────────────────
// Persistence: Supabase-backed sync state
// ─────────────────────────────────────────────

function buildPersistence(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): SyncPersistence {
  return {
    async markSyncing(accountId) {
      await supabase
        .from('connected_accounts')
        .update({ sync_status: 'syncing' })
        .eq('id', accountId)
    },

    async markSuccess(accountId) {
      await supabase
        .from('connected_accounts')
        .update({
          sync_status: 'ok',
          last_synced_at: new Date().toISOString(),
          last_error: null,
          error_code: null,
        })
        .eq('id', accountId)
    },

    async markError(accountId, errorCode: SyncErrorCode, errorMessage: string) {
      await supabase
        .from('connected_accounts')
        .update({
          sync_status: 'error',
          last_error: errorMessage,
          error_code: errorCode,
        })
        .eq('id', accountId)
    },

    async markAuthError(accountId) {
      await supabase
        .from('connected_accounts')
        .update({
          status: 'expired',
          sync_status: 'error',
          error_code: 'auth_error',
          last_error: 'Credentials expired or revoked — re-authorisation required',
        })
        .eq('id', accountId)
    },
  }
}

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

  // Fetch connected account (RLS ensures ownership)
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

  // Only active accounts can be synced
  if (account.status !== 'active') {
    return NextResponse.json(
      { error: `Account is ${account.status} — re-authorisation required` },
      { status: 400 },
    )
  }

  // Look up provider adapter
  try {
    ensureConnectorRegistryInitialized()
  } catch (err) {
    logError('connector_registry_init_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  const adapter = connectorRegistry.get(account.provider)
  if (!adapter) {
    logError('sync_unsupported_provider', { provider: account.provider, accountId })
    return NextResponse.json({ error: `No adapter for provider: ${account.provider}` }, { status: 400 })
  }
  if ((adapter as { implemented?: boolean }).implemented === false) {
    return NextResponse.json(
      { error: `${account.provider} connector is not implemented yet` },
      { status: 501 },
    )
  }

  // Decrypt access token from the vault
  let accessToken: string
  try {
    accessToken = decryptToken(account.token_vault_ref)
  } catch (err) {
    logError('sync_vault_decrypt_failed', {
      accountId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const context = { accessToken, userId, account }
  const persistence = buildPersistence(supabase)

  const stale = isAccountStale(account)
  logInfo('sync_triggered', {
    accountId,
    provider: account.provider,
    stale,
  })

  const outcome = await runAccountSync(adapter, context, persistence)
  await emitAuditEvent(buildAuditPersistence(), {
    userId,
    accountId,
    provider: account.provider,
    eventType: 'sync',
    actor: 'user',
    metadata: {
      stale,
      outcome: outcome.status,
      errorCode: outcome.status === 'error' ? outcome.errorCode : null,
    },
  })

  return NextResponse.json(outcome)
}
