// ============================================================
// POST /api/connectors/ingest/csv
// CSV balance import endpoint for non-OAuth ingestion
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseBalanceCsv, validateCsvFile, createIngestStatus } from '@/lib/connectors/csv-parser'
import { logError, logInfo } from '@/lib/logger'
import type { CsvRow } from '@/lib/connectors/csv-parser'
import { matchProgramByName, type ProgramAliasRow } from '@/lib/connectors/program-matcher'
import { ingestJobs } from './state'
import type { IngestJob } from './state'

// Maximum concurrent jobs per user
const MAX_CONCURRENT_JOBS = 3

type ProgramRow = {
  id: string
  name: string
  slug: string
}

type ConnectedAccountRow = {
  id: string
}

type IngestRow = {
  program_name: string
  balance: number
  program_id: string | null
  program_matched_name: string | null
  confidence: 'exact' | 'alias' | 'fuzzy' | null
  unmatched: boolean
  notes?: string
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
  const [{ data, error }, { data: aliasesData, error: aliasesError }] = await Promise.all([
    supabase
      .from('programs')
      .select('id, name, slug')
      .eq('is_active', true),
    supabase
      .from('program_name_aliases')
      .select('alias, program_slug'),
  ])

  if (error) {
    throw new Error(`Failed to load programs: ${error.message}`)
  }

  const programs = ((data as ProgramRow[] | null) ?? [])
  const aliases = aliasesError?.code === '42P01'
    ? []
    : (((aliasesData ?? []) as ProgramAliasRow[]))
  const rowsById = new Map(programs.map((program) => [program.id, program]))

  const matchedRows: Array<IngestRow & { resolved_program_id: string }> = []
  const unmatchedRows: IngestRow[] = []

  for (const row of rows) {
    const explicitId = typeof row.program_id === 'string' ? row.program_id.trim() : ''
    const explicitMatch = explicitId ? rowsById.get(explicitId) ?? null : null
    const match = explicitMatch
      ? {
          program_id: explicitMatch.id,
          program_name: explicitMatch.name,
          confidence: 'exact' as const,
        }
      : matchProgramByName(row.program_name, programs, aliases)

    const ingestRow: IngestRow = {
      program_name: row.program_name,
      balance: row.balance,
      program_id: match?.program_id ?? null,
      program_matched_name: match?.program_name ?? null,
      confidence: match?.confidence ?? null,
      unmatched: match === null,
      ...(row.notes ? { notes: row.notes } : {}),
    }

    if (match) {
      matchedRows.push({
        ...ingestRow,
        resolved_program_id: match.program_id,
      })
      continue
    }

    unmatchedRows.push(ingestRow)
  }

  return { matchedRows, unmatchedRows }
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
    const previewOnly =
      String(formData.get('previewOnly') ?? '').trim().toLowerCase() === 'true'

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
      j.userId === authUserId && j.status === 'processing'
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

    const { matchedRows, unmatchedRows } = await resolvePrograms(supabase, parseResult.rows)
    if (matchedRows.length === 0) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: parseResult.totalRows,
        validRows: 0,
        invalidRows: parseResult.invalidRows + unmatchedRows.length,
        errors: [
          ...parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
          ...unmatchedRows.map((row) => `Program not recognized: ${row.program_name}`),
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
          unmatched_rows: unmatchedRows,
        },
        { status: 422 }
      )
    }

    if (previewOnly) {
      job.status = 'completed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: parseResult.totalRows,
        validRows: matchedRows.length,
        invalidRows: parseResult.invalidRows + unmatchedRows.length,
        errors: [
          ...parseResult.errors.map((e) => `Row ${e.row}: ${e.message}`),
          ...unmatchedRows.map((row) => `Program not recognized: ${row.program_name}`),
        ],
      }

      return NextResponse.json({
        jobId,
        preview_only: true,
        status: createIngestStatus('completed', {
          processedRows: matchedRows.length,
          totalRows: parseResult.totalRows,
          errors: job.result.errors.length > 0 ? job.result.errors : undefined,
        }),
        summary: {
          totalRows: parseResult.totalRows,
          validRows: matchedRows.length,
          invalidRows: parseResult.invalidRows + unmatchedRows.length,
          importedBalances: 0,
        },
        matched_rows: matchedRows.map(({ resolved_program_id, ...rest }) => {
          void resolved_program_id
          return rest
        }),
        unmatched_rows: unmatchedRows,
        warnings: job.result.errors.length > 0 ? job.result.errors : undefined,
      })
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
      const snapshots = matchedRows.map((row) => ({
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
      const manualRows = matchedRows.map((row) => ({
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
        invalidRows: parseResult.validRows + unmatchedRows.length,
        errors: [
          insertError.message,
          ...unmatchedRows.map((row) => `Program not recognized: ${row.program_name}`),
        ],
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
      invalidRows: parseResult.invalidRows + unmatchedRows.length,
      errors: [
        ...parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
        ...unmatchedRows.map((row) => `Program not recognized: ${row.program_name}`),
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
      invalidRows: parseResult.invalidRows + unmatchedRows.length,
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
        invalidRows: parseResult.invalidRows + unmatchedRows.length,
        importedBalances: importedCount,
      },
      matched_rows: matchedRows.map(({ resolved_program_id, ...rest }) => {
        void resolved_program_id
        return rest
      }),
      unmatched_rows: unmatchedRows,
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
