// ============================================================
// Connected Accounts API — CRUD Lifecycle
// GET  /api/connectors  → list accounts
// POST /api/connectors  → create/connect new account
// ============================================================

import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { requireProfile } from '@/lib/auth-guard'
import { getDb } from '@/lib/db/client'
import { connectedAccounts } from '@/lib/db/schema'
import type { ConnectedAccount, ConnectorProvider } from '@/types/connectors'
import { databaseAuditPersistence, emitAuditEvent } from '@/lib/connectors/audit-log'
import { SYNC_POLICY } from '@/lib/connectors/sync-orchestrator'
import { logInfo, logError } from '@/lib/logger'

// Omit sensitive fields from the response
type ConnectedAccountResponse = Omit<ConnectedAccount, 'token_vault_ref'>

// Valid providers (extend as new connectors are added)
const VALID_PROVIDERS: readonly ConnectorProvider[] = [
  'amex',
  'chase',
  'citi',
  'bilt',
  'capital_one',
  'wells_fargo',
  'bank_of_america',
  'us_bank',
  'discover',
  'barclays',
] as const

function isValidProvider(p: string): p is ConnectorProvider {
  return VALID_PROVIDERS.includes(p as ConnectorProvider)
}

// Public columns (token_vault_ref is never returned)
const ACCOUNT_FIELDS = {
  id: connectedAccounts.id,
  user_id: connectedAccounts.userId,
  provider: connectedAccounts.provider,
  display_name: connectedAccounts.displayName,
  status: connectedAccounts.status,
  token_expires_at: connectedAccounts.tokenExpiresAt,
  scopes: connectedAccounts.scopes,
  last_synced_at: connectedAccounts.lastSyncedAt,
  last_error: connectedAccounts.lastError,
  sync_status: connectedAccounts.syncStatus,
  error_code: connectedAccounts.errorCode,
  created_at: connectedAccounts.createdAt,
  updated_at: connectedAccounts.updatedAt,
}

// Enrich with freshness field for client convenience
function enrichAccount(account: ConnectedAccountResponse): ConnectedAccountResponse & { freshness: string, hours_since_sync: number | null } {
  const lastSyncedAt = account.last_synced_at
  const lastSynced = typeof lastSyncedAt === 'string' ? new Date(lastSyncedAt) : null
  const now = new Date()
  const hoursSinceSync = lastSynced && !isNaN(lastSynced.getTime()) 
    ? (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60) 
    : null
  
  let freshness: 'fresh' | 'stale' | 'never' = 'never'
  if (hoursSinceSync !== null) {
    freshness = (hoursSinceSync * 60 * 60 * 1000) < SYNC_POLICY.staleThresholdMs ? 'fresh' : 'stale'
  }

  return {
    ...account,
    freshness,
    hours_since_sync: hoursSinceSync,
  }
}

// ─────────────────────────────────────────────
// GET /api/connectors — List connected accounts
// ─────────────────────────────────────────────

export async function GET() {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { userId } = auth

  // Fetch connected accounts with freshness info
  let accounts: ConnectedAccountResponse[]
  try {
    accounts = await getDb()
      .select(ACCOUNT_FIELDS)
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId))
      .orderBy(desc(connectedAccounts.createdAt)) as unknown as ConnectedAccountResponse[]
  } catch {
    return NextResponse.json({ error: 'Failed to fetch connected accounts' }, { status: 500 })
  }

  return NextResponse.json({ accounts: accounts.map(enrichAccount) })
}

// ─────────────────────────────────────────────
// POST /api/connectors — Create/connect new account
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { userId } = auth

  // Parse and validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { provider, display_name, token_vault_ref, scopes } = body as {
    provider?: unknown
    display_name?: unknown
    token_vault_ref?: unknown
    scopes?: unknown
  }

  // Strict validation
  if (typeof provider !== 'string' || !isValidProvider(provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 }
    )
  }

  if (typeof display_name !== 'string' || display_name.trim().length === 0) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 })
  }

  if (typeof token_vault_ref !== 'string' || token_vault_ref.trim().length === 0) {
    return NextResponse.json({ error: 'token_vault_ref is required' }, { status: 400 })
  }

  if (!Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: 'scopes must be a non-empty array' }, { status: 400 })
  }

  // Check for duplicate connections (DB enforces uniqueness on user_id + provider)
  const db = getDb()
  const [existing] = await db
    .select({ id: connectedAccounts.id, status: connectedAccounts.status })
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.provider, provider)))
    .limit(1)

  if (existing) {
    return NextResponse.json(
      { error: `A connection for ${provider} already exists (status: ${existing.status}). Please remove it before connecting again.` },
      { status: 409 }
    )
  }

  // Create the connected account
  let account: ConnectedAccountResponse | undefined
  let insertError: string | null = null
  try {
    ;[account] = await db
      .insert(connectedAccounts)
      .values({
        userId,
        provider,
        displayName: display_name.trim(),
        tokenVaultRef: token_vault_ref.trim(),
        scopes: scopes.join(' '), // Store as space-separated string
        status: 'active',
        syncStatus: 'pending',
        lastSyncedAt: null,
      })
      .returning(ACCOUNT_FIELDS) as unknown as ConnectedAccountResponse[]
  } catch (error) {
    insertError = error instanceof Error ? error.message : String(error)
  }

  if (!account) {
    logError('connector_create_failed', {
      userId,
      provider,
      error: insertError,
    })
    return NextResponse.json({ error: 'Failed to create connected account' }, { status: 500 })
  }

  const accountId = account.id

  logInfo('connector_created', {
    accountId,
    provider,
    userId,
  })

  // Emit audit event
  await emitAuditEvent(databaseAuditPersistence(), {
    userId,
    accountId,
    provider,
    eventType: 'connect',
    actor: 'user',
    metadata: {
      displayName: display_name.trim(),
      scopes,
    },
  })

  return NextResponse.json(
    { account: enrichAccount(account) },
    { status: 201 }
  )
}
