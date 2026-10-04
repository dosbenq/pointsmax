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
import { and, eq } from 'drizzle-orm'
import { getSessionUser, getUserRowId } from '@/lib/auth'
import { UUID_RE } from '@/lib/auth-guard'
import { getDb } from '@/lib/db/client'
import { columnsOf } from '@/lib/db/columns'
import { balanceSnapshots, connectedAccounts } from '@/lib/db/schema'
import { connectorRegistry } from '@/lib/connectors/connector-registry'
import { decryptToken } from '@/lib/connectors/token-vault'
import { runAccountSync, type SyncPersistence } from '@/lib/connectors/sync-orchestrator'
import { isAccountStale } from '@/lib/connectors/sync-orchestrator'
import { logInfo, logError } from '@/lib/logger'
import type { ConnectedAccount, FetchBalanceResult, SyncErrorCode } from '@/types/connectors'
import { databaseAuditPersistence, emitAuditEvent } from '@/lib/connectors/audit-log'
import { ensureConnectorRegistryInitialized } from '@/lib/connectors/adapters'
import { canUseFeature, getUserTier } from '@/lib/subscription'

// ─────────────────────────────────────────────
// Persistence: Supabase-backed sync state
// ─────────────────────────────────────────────

function buildPersistence(account: ConnectedAccount): SyncPersistence {
  const db = getDb()
  const thisAccount = (accountId: string) =>
    and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, account.user_id))

  const buildSnapshotRows = (result: FetchBalanceResult) => {
    const fetchedAt = new Date().toISOString()
    return Object.entries(result.balances)
      .filter(([programId, balance]) => {
        return (
          typeof programId === 'string'
          && programId.length > 0
          && Number.isFinite(balance)
          && balance >= 0
        )
      })
      .map(([programId, balance]) => ({
        connectedAccountId: account.id,
        userId: account.user_id,
        programId,
        balance: Math.floor(balance),
        source: 'connector' as const,
        providerCursor: result.cursor,
        rawPayload: result.rawPayload ?? null,
        fetchedAt,
      }))
  }

  return {
    async markSyncing(accountId) {
      try {
        await db.update(connectedAccounts).set({ syncStatus: 'syncing' }).where(thisAccount(accountId))
      } catch (error) {
        logError('connector_sync_mark_syncing_failed', {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },

    async markSuccess(accountId, result) {
      const snapshotRows = buildSnapshotRows(result)

      if (snapshotRows.length > 0) {
        try {
          await db.insert(balanceSnapshots).values(snapshotRows)
        } catch (error) {
          logError('connector_sync_snapshot_insert_failed', {
            accountId,
            error: error instanceof Error ? error.message : String(error),
            snapshotCount: snapshotRows.length,
          })
        }
      }

      try {
        await db
          .update(connectedAccounts)
          .set({
            syncStatus: 'ok',
            lastSyncedAt: new Date().toISOString(),
            lastError: null,
            errorCode: null,
          })
          .where(thisAccount(accountId))
      } catch (error) {
        logError('connector_sync_mark_success_failed', {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },

    async markError(accountId, errorCode: SyncErrorCode, errorMessage: string) {
      try {
        await db
          .update(connectedAccounts)
          .set({ syncStatus: 'error', lastError: errorMessage, errorCode })
          .where(thisAccount(accountId))
      } catch (error) {
        logError('connector_sync_mark_error_failed', {
          accountId,
          errorCode,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },

    async markAuthError(accountId) {
      try {
        await db
          .update(connectedAccounts)
          .set({
            status: 'expired',
            syncStatus: 'error',
            errorCode: 'auth_error',
            lastError: 'Credentials expired or revoked — re-authorisation required',
          })
          .where(thisAccount(accountId))
      } catch (error) {
        logError('connector_sync_mark_auth_error_failed', {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }
}

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

  const tier = await getUserTier(userId)
  if (!canUseFeature(tier, 'connector_sync')) {
    return NextResponse.json(
      {
        error: {
          code: 'PREMIUM_REQUIRED',
          message: 'Wallet sync requires PointsMax Premium.',
        },
      },
      { status: 403 },
    )
  }

  // Fetch connected account — explicit user_id check enforces ownership
  const [accountRow] = UUID_RE.test(accountId)
    ? await getDb()
      .select(columnsOf(connectedAccounts))
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
      .limit(1)
    : []

  if (!accountRow) {
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
  const persistence = buildPersistence(account)

  const stale = isAccountStale(account)
  logInfo('sync_triggered', {
    accountId,
    provider: account.provider,
    stale,
  })

  const outcome = await runAccountSync(adapter, context, persistence)
  await emitAuditEvent(databaseAuditPersistence(), {
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
