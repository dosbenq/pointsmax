// ============================================================
// Deployment self-check for the move to Neon: which settings are present,
// whether the schema is applied, and a rehearsal of the Supabase copy.
// Reports booleans, counts and sanitised errors only.
// ============================================================

import { getDb } from '@/lib/db/client'
import { ensureSchema } from '@/lib/db/migrate'
import {
  createSupabaseReader,
  importFromSupabase,
  isSupabaseImportComplete,
  type ImportReport,
  type SourceReader,
  type SupabaseLike,
} from '@/lib/db/supabase-import'
import { createAdminClient } from '@/lib/supabase'
import { getSetupReadiness } from '@/lib/setup-readiness'

type Failure = { ok: false; error: string }

export type SetupStatus = {
  configured: ReturnType<typeof getSetupReadiness> & { supabase_source: boolean }
  schema: { ok: true; migrations: number; applied_now: string[] } | Failure
  import_complete?: boolean
  rehearsal?: ({ ok: true } & ImportReport) | Failure | { ok: null; skipped: string }
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

export async function runSetupCheck(
  createReader: () => SourceReader = () => createSupabaseReader(createAdminClient() as unknown as SupabaseLike),
): Promise<SetupStatus> {
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

  let importComplete: boolean
  try {
    importComplete = await isSupabaseImportComplete(getDb())
  } catch (error) {
    return { configured, schema, rehearsal: { ok: false, error: sanitizeError(error) }, checked_at: checkedAt }
  }

  let rehearsal: NonNullable<SetupStatus['rehearsal']>
  if (importComplete) {
    rehearsal = { ok: null, skipped: 'The copy from Supabase has already been done' }
  } else if (!configured.supabase_source) {
    rehearsal = { ok: null, skipped: 'Supabase credentials are not set' }
  } else {
    try {
      rehearsal = { ok: true, ...(await importFromSupabase(getDb(), createReader(), { dryRun: true })) }
    } catch (error) {
      rehearsal = { ok: false, error: sanitizeError(error) }
    }
  }

  return { configured, schema, import_complete: importComplete, rehearsal, checked_at: checkedAt }
}

const CACHE_MS = 10 * 60 * 1000
type Cached = { at: number; promise: Promise<SetupStatus> }

/** runSetupCheck, shared by concurrent callers and reused for 10 minutes per server instance. */
export function getSetupStatus(): Promise<SetupStatus> {
  const g = globalThis as typeof globalThis & { __pointsmaxSetupStatus?: Cached }
  const cached = g.__pointsmaxSetupStatus
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise
  const next: Cached = { at: Date.now(), promise: runSetupCheck() }
  g.__pointsmaxSetupStatus = next
  return next.promise
}
