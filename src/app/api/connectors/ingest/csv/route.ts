// ============================================================
// POST /api/connectors/ingest/csv
// CSV balance import endpoint for non-OAuth ingestion
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseBalanceCsv, validateCsvFile, createIngestStatus } from '@/lib/connectors/csv-parser'
import { logError, logInfo } from '@/lib/logger'
import type { CsvRow } from '@/lib/connectors/csv-parser'
import { ingestJobs } from './state'
import type { IngestJob } from './state'

// Maximum concurrent jobs per user
const MAX_CONCURRENT_JOBS = 3

type ProgramRow = {
  id: string
  name: string | null
  short_name: string | null
  slug: string | null
}

type ConnectedAccountRow = {
  id: string
}

function normalizeProgramKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function matchesProgramFuzzy(search: string, keys: string[]): boolean {
  return keys.some((key) => (
    key.includes(search)
    || search.includes(key)
    || key.split(' ')[0] === search.split(' ')[0]
  ))
}

async function getCurrentUserRowId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authId: string,
): Promise<string | null> {
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .single()

  const id = (userRecord as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : null
}

async function resolvePrograms(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: CsvRow[],
) {
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, short_name, slug')
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to load programs: ${error.message}`)
  }

  const rowsById = new Map<string, ProgramRow>()
  const rowsByKey = new Map<string, ProgramRow>()
  const allPrograms: Array<{ row: ProgramRow; keys: string[] }> = []
  for (const row of ((data as ProgramRow[] | null) ?? [])) {
    rowsById.set(row.id, row)
    const keys: string[] = []
    for (const raw of [row.id, row.name, row.short_name, row.slug]) {
      if (typeof raw !== 'string' || raw.trim().length === 0) continue
      const normalized = normalizeProgramKey(raw)
      rowsByKey.set(normalized, row)
      keys.push(normalized)
    }
    allPrograms.push({ row, keys })
  }

  const resolved: Array<CsvRow & { resolved_program_id: string }> = []
  const unresolvedErrors: string[] = []

  for (const row of rows) {
    const explicitId = typeof row.program_id === 'string' ? row.program_id.trim() : ''
    const byId = explicitId ? rowsById.get(explicitId) : null
    const normalizedSearch = normalizeProgramKey(explicitId || row.program_name)
    const byKey = rowsByKey.get(normalizedSearch)
    const fuzzy = allPrograms.find(({ keys }) => matchesProgramFuzzy(normalizedSearch, keys))?.row
    const match = byId ?? byKey ?? fuzzy ?? null

    if (!match) {
      unresolvedErrors.push(`Program not recognized: ${row.program_name}`)
      continue
    }

    resolved.push({
      ...row,
      resolved_program_id: match.id,
    })
  }

  return { resolved, unresolvedErrors }
}

async function validateConnectedAccountOwnership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  connectedAccountId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('id')
    .eq('id', connectedAccountId)
    .eq('user_id', userId)
    .single()

  return !error && !!(data as ConnectedAccountRow | null)?.id
}

// ─────────────────────────────────────────────
// POST /api/connectors/ingest/csv
// Upload and process a CSV file of balances
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  // Auth check
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const authUserId = user.id

  try {
    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const connectedAccountId = formData.get('connectedAccountId') as string | null

    const userId = await getCurrentUserRowId(supabase, authUserId)
    if (!userId) {
      return NextResponse.json(
        { error: 'User record not found' },
        { status: 404 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const fileValidation = validateCsvFile(file)
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      )
    }

    // Check concurrent job limit
    const userJobs = Array.from(ingestJobs.values()).filter(j => 
      j.userId === userId && j.status === 'processing'
    )
    if (userJobs.length >= MAX_CONCURRENT_JOBS) {
      return NextResponse.json(
        { error: 'Too many concurrent imports. Please wait for existing jobs to complete.' },
        { status: 429 }
      )
    }

    // Create job record
    const jobId = crypto.randomUUID()
    const job: IngestJob = {
      id: jobId,
      userId: authUserId,
      status: 'processing',
      startedAt: new Date().toISOString(),
    }
    ingestJobs.set(jobId, job)

    logInfo('csv_ingest_started', {
      requestId,
      jobId,
      userId,
      fileName: file.name,
      fileSize: file.size,
    })

    // Read and parse CSV
    const csvContent = await file.text()
    const parseResult = parseBalanceCsv(csvContent)

    if (!parseResult.success) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [parseResult.error],
      }

      logError('csv_ingest_parse_failed', {
        requestId,
        jobId,
        error: parseResult.error,
      })

      return NextResponse.json(
        {
          error: parseResult.error,
          jobId,
          status: createIngestStatus('failed'),
        },
        { status: 422 }
      )
    }

    // If no valid rows, fail early
    if (parseResult.validRows === 0) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: parseResult.totalRows,
        validRows: 0,
        invalidRows: parseResult.invalidRows,
        errors: parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
      }

      return NextResponse.json(
        {
          error: 'No valid rows found in CSV',
          jobId,
          status: createIngestStatus('failed', {
            customMessage: `Import failed: No valid rows found. ${parseResult.errors.length} errors detected.`,
            errors: parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
          }),
          details: parseResult.errors,
        },
        { status: 422 }
      )
    }

    const { resolved, unresolvedErrors } = await resolvePrograms(supabase, parseResult.rows)
    if (resolved.length === 0) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: parseResult.totalRows,
        validRows: 0,
        invalidRows: parseResult.invalidRows + unresolvedErrors.length,
        errors: [
          ...parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
          ...unresolvedErrors,
        ],
      }

      return NextResponse.json(
        {
          error: 'No importable rows found in CSV',
          jobId,
          status: createIngestStatus('failed', {
            customMessage: 'Import failed: all rows were invalid or unmatched.',
            errors: job.result.errors,
          }),
        },
        { status: 422 }
      )
    }

    let insertError: { message: string } | null = null
    let importedCount = 0
    if (connectedAccountId && connectedAccountId.trim().length > 0) {
      const isOwned = await validateConnectedAccountOwnership(supabase, connectedAccountId, userId)
      if (!isOwned) {
        return NextResponse.json(
          { error: 'Connected account not found' },
          { status: 404 }
        )
      }

      const fetchedAt = new Date().toISOString()
      const snapshots = resolved.map((row) => ({
        connected_account_id: connectedAccountId,
        user_id: userId,
        program_id: row.resolved_program_id,
        balance: row.balance,
        source: 'manual' as const,
        raw_payload: row.notes ? { notes: row.notes, import_source: 'csv' } : { import_source: 'csv' },
        fetched_at: fetchedAt,
      }))

      const result = await supabase
        .from('balance_snapshots')
        .insert(snapshots)
      insertError = result.error
      importedCount = snapshots.length
    } else {
      const manualRows = resolved.map((row) => ({
        user_id: userId,
        program_id: row.resolved_program_id,
        balance: row.balance,
        updated_at: new Date().toISOString(),
      }))

      const result = await supabase
        .from('user_balances')
        .upsert(manualRows, { onConflict: 'user_id,program_id' })
      insertError = result.error
      importedCount = manualRows.length
    }

    if (insertError) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: parseResult.totalRows,
        validRows: 0,
        invalidRows: parseResult.validRows + unresolvedErrors.length,
        errors: [insertError.message, ...unresolvedErrors],
      }

      logError('csv_ingest_db_failed', {
        requestId,
        jobId,
        error: insertError.message,
      })

      return NextResponse.json(
        {
          error: 'Failed to save balances to database',
          jobId,
          status: createIngestStatus('failed'),
        },
        { status: 500 }
      )
    }

    // Update job as completed
    job.status = 'completed'
    job.completedAt = new Date().toISOString()
    job.result = {
      totalRows: parseResult.totalRows,
      validRows: importedCount,
      invalidRows: parseResult.invalidRows + unresolvedErrors.length,
      errors: [
        ...parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
        ...unresolvedErrors,
      ],
    }

    const duration = Date.now() - startedAt

    logInfo('csv_ingest_completed', {
      requestId,
      jobId,
      userId,
      durationMs: duration,
      totalRows: parseResult.totalRows,
      validRows: importedCount,
      invalidRows: parseResult.invalidRows + unresolvedErrors.length,
    })

    // Return success response
    return NextResponse.json({
      jobId,
      status: createIngestStatus('completed', {
        processedRows: importedCount,
        totalRows: parseResult.totalRows,
        errors: job.result.errors.length > 0 
          ? job.result.errors
          : undefined,
      }),
      summary: {
        totalRows: parseResult.totalRows,
        validRows: importedCount,
        invalidRows: parseResult.invalidRows + unresolvedErrors.length,
        importedBalances: importedCount,
      },
      warnings: job.result.errors.length > 0 ? job.result.errors : undefined,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logError('csv_ingest_unexpected_error', {
      requestId,
      userId: authUserId,
      error: errorMessage,
    })

    return NextResponse.json(
      {
        error: 'Import failed due to an unexpected error',
        status: createIngestStatus('failed'),
      },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// GET /api/connectors/ingest/csv?jobId=xxx
// Check status of an ingestion job
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')

  // Auth check
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  if (!jobId) {
    // Return all jobs for user
    const userJobs = Array.from(ingestJobs.values())
      .filter(j => j.userId === user.id)
      .map(j => ({
        jobId: j.id,
        status: j.status,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        ...(j.result && {
          summary: {
            totalRows: j.result.totalRows,
            validRows: j.result.validRows,
            invalidRows: j.result.invalidRows,
          },
        }),
      }))

    return NextResponse.json({
      jobs: userJobs,
    })
  }

  // Return specific job
  const job = ingestJobs.get(jobId)

  if (!job || job.userId !== user.id) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    jobId: job.id,
    status: createIngestStatus(job.status, {
      processedRows: job.result?.validRows,
      totalRows: job.result?.totalRows,
      errors: job.result?.errors,
    }),
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    ...(job.result && {
      summary: {
        totalRows: job.result.totalRows,
        validRows: job.result.validRows,
        invalidRows: job.result.invalidRows,
      },
    }),
  })
}
