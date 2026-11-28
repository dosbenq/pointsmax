// ============================================================
// One-off copy of user data from the old Supabase database into Neon.
//
// - Rows keep their original IDs, so links between tables survive.
// - Emails are lowercased; the first Google sign-in links a profile by email.
// - users.auth_id is cleared: the old values point at Supabase's auth schema.
// - Every table is read in pages and checked against Supabase's exact count;
//   any mismatch aborts the whole copy.
// - Writes run in one transaction under an advisory lock. A rehearsal
//   (dryRun) does all the work and then rolls back, returning counts only.
// - A real import records a marker row and is a no-op afterwards.
// ============================================================

import { count, eq, getTableColumns, sql, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { Database } from './client'
import {
  affiliateClicks,
  alertSubscriptions,
  dataImports,
  flightWatches,
  sharedTrips,
  stripeWebhookEvents,
  subscriptionEvents,
  transferBonuses,
  userBalances,
  userPreferences,
  users,
} from './schema'

export const SUPABASE_IMPORT_ID = 'supabase-v1'
const IMPORT_LOCK_KEY = 74_200_002
const SOURCE_PAGE_SIZE = 1000
const INSERT_BATCH_SIZE = 200

type Row = Record<string, unknown>

// ── Reading from Supabase ──────────────────────────────────────

export type SourceTable = { rows: Row[]; missing: boolean }
export type SourceReader = { readAll(table: string, orderBy: string): Promise<SourceTable> }

type SupabaseResult = { data: Row[] | null; error: { message: string; code?: string } | null; count: number | null }
/** The slice of the Supabase client this module uses. */
export type SupabaseLike = {
  from(table: string): {
    select(columns: string, options: { count: 'exact' }): {
      order(column: string, options: { ascending: boolean }): {
        range(from: number, to: number): PromiseLike<SupabaseResult>
      }
    }
  }
}

/** Only these codes mean "no such table"; anything else (a bad column, say) must abort the copy. */
function isMissingTable(error: { message: string; code?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01'
}

export function createSupabaseReader(client: SupabaseLike, pageSize = SOURCE_PAGE_SIZE): SourceReader {
  return {
    async readAll(table, orderBy) {
      const rows: Row[] = []
      let expected: number | null = null
      for (let from = 0; ; from += pageSize) {
        const { data, error, count: total } = await client
          .from(table)
          .select('*', { count: 'exact' })
          .order(orderBy, { ascending: true })
          .range(from, from + pageSize - 1)
        if (error) {
          if (from === 0 && isMissingTable(error)) return { rows: [], missing: true }
          throw new Error(`Reading ${table} from Supabase failed: ${error.message}`)
        }
        if (expected === null) expected = total
        const page = data ?? []
        rows.push(...page)
        if (page.length < pageSize) break
      }
      if (expected === null || rows.length !== expected) {
        throw new Error(`Reading ${table} from Supabase returned ${rows.length} rows but Supabase reports ${expected ?? 'unknown'}`)
      }
      return { rows, missing: false }
    },
  }
}

// ── Mapping rows ───────────────────────────────────────────────

/** Copy the listed snake_case columns that exist in the source row. */
function pick(row: Row, columns: string[]): Row {
  const out: Row = {}
  for (const column of columns) {
    if (row[column] !== undefined) out[column] = row[column]
  }
  return out
}

/** snake_case source row → Drizzle (camelCase) insert values for `table`. */
function toInsertValues(table: PgTable, row: Row): Row {
  const values: Row = {}
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (row[column.name] !== undefined) values[key] = row[column.name]
  }
  return values
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

type TablePlan = {
  name: string
  orderBy: string
  table: PgTable
  conflictTarget: PgColumn
  columns: string[]
  /** Required reference to users.id; rows pointing at an unknown user are skipped. */
  requiredUserColumn?: string
  /** Optional references to users.id; unknown users become null. */
  optionalUserColumns?: string[]
  emailColumn?: string
}

const PLANS: TablePlan[] = [
  {
    name: 'users',
    orderBy: 'id',
    table: users,
    conflictTarget: users.id,
    columns: ['id', 'email', 'tier', 'stripe_customer_id', 'created_at', 'last_seen_at', 'tier_updated_at'],
    emailColumn: 'email',
  },
  {
    name: 'user_preferences',
    orderBy: 'user_id',
    table: userPreferences,
    conflictTarget: userPreferences.userId,
    columns: ['user_id', 'home_airport', 'preferred_cabin', 'preferred_airlines', 'avoided_airlines', 'digest_email_enabled', 'updated_at'],
    requiredUserColumn: 'user_id',
  },
  {
    name: 'user_balances',
    orderBy: 'id',
    table: userBalances,
    conflictTarget: userBalances.id,
    columns: ['id', 'user_id', 'program_id', 'balance', 'updated_at'],
    requiredUserColumn: 'user_id',
  },
  {
    name: 'alert_subscriptions',
    orderBy: 'id',
    table: alertSubscriptions,
    conflictTarget: alertSubscriptions.id,
    columns: ['id', 'email', 'user_id', 'program_ids', 'is_active', 'created_at'],
    optionalUserColumns: ['user_id'],
    emailColumn: 'email',
  },
  {
    name: 'flight_watches',
    orderBy: 'id',
    table: flightWatches,
    conflictTarget: flightWatches.id,
    columns: ['id', 'user_id', 'origin', 'destination', 'cabin', 'start_date', 'end_date', 'max_points', 'is_active', 'last_checked_at', 'created_at', 'last_alert_key', 'last_alerted_at'],
    requiredUserColumn: 'user_id',
  },
  {
    name: 'transfer_bonuses',
    orderBy: 'id',
    table: transferBonuses,
    conflictTarget: transferBonuses.id,
    columns: ['id', 'transfer_partner_id', 'bonus_pct', 'start_date', 'end_date', 'source_url', 'is_verified', 'notes', 'auto_detected', 'alerted_at', 'created_at'],
  },
  {
    name: 'affiliate_clicks',
    orderBy: 'id',
    table: affiliateClicks,
    conflictTarget: affiliateClicks.id,
    columns: ['id', 'card_id', 'user_id', 'source_page', 'rank', 'region', 'recommendation_mode', 'program_id', 'created_at'],
    optionalUserColumns: ['user_id'],
  },
  {
    name: 'shared_trips',
    orderBy: 'id',
    table: sharedTrips,
    conflictTarget: sharedTrips.id,
    columns: ['id', 'region', 'trip_data', 'created_by', 'created_at'],
    optionalUserColumns: ['created_by'],
  },
  {
    name: 'subscription_events',
    orderBy: 'id',
    table: subscriptionEvents,
    conflictTarget: subscriptionEvents.id,
    columns: ['id', 'user_id', 'stripe_customer_id', 'event_type', 'previous_tier', 'new_tier', 'occurred_at', 'metadata'],
    optionalUserColumns: ['user_id'],
  },
  {
    name: 'stripe_webhook_events',
    orderBy: 'stripe_event_id',
    table: stripeWebhookEvents,
    conflictTarget: stripeWebhookEvents.stripeEventId,
    columns: ['stripe_event_id', 'event_type', 'processed_at', 'raw_payload'],
  },
]

export type TableReport = { source: number; written: number; skipped: number; missing?: true }
export type ImportReport = {
  status: 'rehearsed' | 'imported' | 'already_imported'
  tables: Record<string, TableReport>
  /** Users whose emails only differ by letter case (they would collide once lowercased). */
  duplicateEmails: number
}

type PreparedTable = { plan: TablePlan; rows: Row[]; report: TableReport }

function prepare(plan: TablePlan, source: SourceTable, knownUserIds: Set<string>): PreparedTable {
  const report: TableReport = { source: source.rows.length, written: 0, skipped: 0 }
  if (source.missing) report.missing = true
  const rows: Row[] = []
  const seenEmails = new Set<string>()

  for (const sourceRow of source.rows) {
    const row = pick(sourceRow, plan.columns)
    if (plan.requiredUserColumn && !knownUserIds.has(String(row[plan.requiredUserColumn]))) {
      report.skipped += 1
      continue
    }
    for (const column of plan.optionalUserColumns ?? []) {
      if (row[column] != null && !knownUserIds.has(String(row[column]))) row[column] = null
    }
    if (plan.emailColumn) {
      const email = normalizeEmail(row[plan.emailColumn])
      if (seenEmails.has(email)) {
        report.skipped += 1
        continue
      }
      seenEmails.add(email)
      row[plan.emailColumn] = email
    }
    rows.push(row)
  }

  report.written = rows.length
  return { plan, rows, report }
}

/** `set` clause that overwrites every copied column with the incoming value. */
function excludedSet(plan: TablePlan): Record<string, SQL> {
  const set: Record<string, SQL> = {}
  for (const [key, column] of Object.entries(getTableColumns(plan.table))) {
    if (plan.columns.includes(column.name)) set[key] = sql.raw(`excluded."${column.name}"`)
  }
  return set
}

class Rollback extends Error {}

export async function importFromSupabase(
  db: Database,
  reader: SourceReader,
  options: { dryRun: boolean },
): Promise<ImportReport> {
  // Read everything first, outside the transaction.
  const sources = new Map<string, SourceTable>()
  for (const plan of PLANS) sources.set(plan.name, await reader.readAll(plan.name, plan.orderBy))

  const userPlan = PLANS[0]
  const preparedUsers = prepare(userPlan, sources.get('users')!, new Set())
  const duplicateEmails = preparedUsers.report.skipped
  if (duplicateEmails > 0 && !options.dryRun) {
    throw new Error(`${duplicateEmails} users share an email that differs only by letter case; resolve them before importing`)
  }
  const knownUserIds = new Set(preparedUsers.rows.map((row) => String(row.id)))
  const prepared = [preparedUsers, ...PLANS.slice(1).map((plan) => prepare(plan, sources.get(plan.name)!, knownUserIds))]
  const tables = Object.fromEntries(prepared.map(({ plan, report }) => [plan.name, report]))

  let result: ImportReport | null = null
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`)

      if (!options.dryRun) {
        const [marker] = await tx.select().from(dataImports).where(eq(dataImports.id, SUPABASE_IMPORT_ID))
        if (marker) {
          result = { status: 'already_imported', tables: marker.counts as Record<string, TableReport>, duplicateEmails: 0 }
          return
        }
      }

      for (const { plan, rows } of prepared) {
        for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
          const batch = rows.slice(i, i + INSERT_BATCH_SIZE).map((row) => toInsertValues(plan.table, row))
          await tx
            .insert(plan.table)
            .values(batch as never)
            .onConflictDoUpdate({ target: plan.conflictTarget, set: excludedSet(plan) as never })
        }
        // Every row read must now be in Neon (written) or deliberately skipped.
        const [{ total }] = await tx.select({ total: count() }).from(plan.table)
        if (total < rows.length) {
          throw new Error(`${plan.name}: expected at least ${rows.length} rows in Neon, found ${total}`)
        }
      }

      if (options.dryRun) {
        result = { status: 'rehearsed', tables, duplicateEmails }
        throw new Rollback()
      }

      await tx.insert(dataImports).values({ id: SUPABASE_IMPORT_ID, counts: tables })
      result = { status: 'imported', tables, duplicateEmails }
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  return result!
}

/** Has the Supabase copy been completed? */
export async function isSupabaseImportComplete(db: Database): Promise<boolean> {
  const [marker] = await db.select({ id: dataImports.id }).from(dataImports).where(eq(dataImports.id, SUPABASE_IMPORT_ID))
  return Boolean(marker)
}
