// ============================================================
// Deployment self-check for the Neon database: which settings are present,
// whether the schema is applied, and whether the one-off copy from Supabase
// has finished (running it if it has not). Reports booleans, counts and
// sanitised errors only.
// ============================================================

import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { ensureSchema } from '@/lib/db/migrate'
import { ensureDatabaseReady } from '@/lib/db/ready'
import { dataImports } from '@/lib/db/schema'
import { SUPABASE_IMPORT_ID, type TableReport } from '@/lib/db/supabase-import'
import { getSetupReadiness } from '@/lib/setup-readiness'

type Failure = { ok: false; error: string }

export type SetupStatus = {
  configured: ReturnType<typeof getSetupReadiness> & { supabase_source: boolean }
  schema: { ok: true; migrations: number; applied_now: string[] } | Failure
  import?:
    | { ok: true; complete: true; completed_at: string; tables: Record<string, TableReport> }
    | { ok: true; complete: false; reason: string }
    | Failure
  checked_at: string
}

/** Error text safe to show publicly: no connection strings or tokens, bounded length. */
export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[database-url]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/(password|secret|key)=\S+/gi, '$1=[hidden]')
    .slice(0, 300)
}

function hasSupabaseSource(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export async function runSetupCheck(): Promise<SetupStatus> {
  const checkedAt = new Date().toISOString()
  const configured = { ...getSetupReadiness(), supabase_source: hasSupabaseSource() }
  if (!configured.database_url) {
    return { configured, schema: { ok: false, error: 'DATABASE_URL is not set' }, checked_at: checkedAt }
  }

  let schema: SetupStatus['schema']
  try {
    const result = await ensureSchema(getDb)
    schema = { ok: true, migrations: result.total, applied_now: result.applied }
  } catch (error) {
    return { configured, schema: { ok: false, error: sanitizeError(error) }, checked_at: checkedAt }
  }

  try {
    // Runs the Supabase copy if it has not happened yet.
    await ensureDatabaseReady()
    const [marker] = await getDb().select().from(dataImports).where(eq(dataImports.id, SUPABASE_IMPORT_ID))
    const result: NonNullable<SetupStatus['import']> = marker
      ? { ok: true, complete: true, completed_at: marker.completedAt, tables: marker.counts as Record<string, TableReport> }
      : { ok: true, complete: false, reason: 'Nothing to copy outside production without Supabase credentials' }
    return { configured, schema, import: result, checked_at: checkedAt }
  } catch (error) {
    return { configured, schema, import: { ok: false, error: sanitizeError(error) }, checked_at: checkedAt }
  }
}

const CACHE_MS = 30 * 1000
type Cached = { at: number; promise: Promise<SetupStatus> }

/** runSetupCheck, shared by concurrent callers and reused for 30 seconds per server instance. */
export function getSetupStatus(): Promise<SetupStatus> {
  const g = globalThis as typeof globalThis & { __pointsmaxSetupStatus?: Cached }
  const cached = g.__pointsmaxSetupStatus
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise
  const next: Cached = { at: Date.now(), promise: runSetupCheck() }
  g.__pointsmaxSetupStatus = next
  return next.promise
}
