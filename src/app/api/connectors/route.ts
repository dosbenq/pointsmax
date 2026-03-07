// ============================================================
// Connected Accounts API — CRUD Lifecycle
// GET  /api/connectors  → list accounts
// POST /api/connectors  → create/connect new account
// ============================================================

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ConnectedAccount, ConnectorProvider } from '@/types/connectors'
import { emitAuditEvent, type AuditPersistence } from '@/lib/connectors/audit-log'
import { SYNC_POLICY } from '@/lib/connectors/sync-orchestrator'
import { logInfo, logError } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase'

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
  const supabase = await createSupabaseServerClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  // Fetch connected accounts with freshness info
  const { data: accounts, error } = await supabase
    .from('connected_accounts')
    .select('id, user_id, provider, display_name, status, token_expires_at, scopes, last_synced_at, last_error, sync_status, error_code, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch connected accounts' }, { status: 500 })
  }

  return NextResponse.json({ 
    accounts: (accounts as unknown as ConnectedAccountResponse[] ?? []).map(enrichAccount) 
  })
}

// ─────────────────────────────────────────────
// POST /api/connectors — Create/connect new account
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const { data: existing } = await supabase
    .from('connected_accounts')
    .select('id, status')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: `A connection for ${provider} already exists (status: ${existing.status}). Please remove it before connecting again.` },
      { status: 409 }
    )
  }

  // Create the connected account
  const { data: account, error: insertError } = await supabase
    .from('connected_accounts')
    .insert({
      user_id: userId,
      provider,
      display_name: display_name.trim(),
      token_vault_ref: token_vault_ref.trim(),
      scopes: scopes.join(' '), // Store as space-separated string
      status: 'active',
      sync_status: 'pending',
      last_synced_at: null,
    })
    .select('id, user_id, provider, display_name, status, token_expires_at, scopes, last_synced_at, last_error, sync_status, error_code, created_at, updated_at')
    .single()

  if (insertError || !account) {
    logError('connector_create_failed', {
      userId,
      provider,
      error: insertError?.message,
    })
    return NextResponse.json({ error: 'Failed to create connected account' }, { status: 500 })
  }

  const accountId = (account as { id: string }).id

  logInfo('connector_created', {
    accountId,
    provider,
    userId,
  })

  // Emit audit event
  await emitAuditEvent(buildAuditPersistence(), {
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
    { account: enrichAccount(account as unknown as ConnectedAccountResponse) },
    { status: 201 }
  )
}
